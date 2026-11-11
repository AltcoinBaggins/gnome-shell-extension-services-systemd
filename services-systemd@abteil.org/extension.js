import GLib from 'gi://GLib';
import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {PopupServiceItem} from './popupServiceItem.js';

class ServicesManager {
    constructor(extension) {
        this._extension = extension;
        this._settings = extension.getSettings();
        this._entries = [];
        this._containerType = -1;

        this._settingsChangedId = this._settings.connect('changed', () => {
            this._loadConfig();
            this._refresh();
        });

        this._createContainer();
        this._loadConfig();
        this._refresh();
    }

    readJSONConfig(filename) {
        let file = `${GLib.get_home_dir()}/${filename}`;

        try {
            let [success, contents] = GLib.file_get_contents(file);
            if (success)
                return JSON.parse(new TextDecoder().decode(contents));
        } catch (e) {
            log(`Exception while reading ${file}: ${e}`);
        }

        return [];
    }

    _createContainer() {
        this._containerType = this._settings.get_enum('position');

        if (this._containerType === 0) {
            this.container = new PanelMenu.Button(0.0, _('Systemd Services'));

            let hbox = new St.BoxLayout({style_class: 'panel-status-menu-box'});
            let icon = new St.Icon({
                icon_name: 'system-run-symbolic',
                style_class: 'system-status-icon',
            });
            hbox.add_child(icon);

            this.container.add_child(hbox);
            this.container.add_style_class_name('panel-status-button');
            Main.panel.addToStatusArea('servicesManager', this.container);
        } else {
            this.container = new PopupMenu.PopupSubMenuMenuItem(_('Systemd Services'), true);
            this.container.icon.icon_name = 'system-run-symbolic';
            Main.panel.statusArea.aggregateMenu.menu.addMenuItem(this.container, 8);
        }

        this._menuOpenChangedId = this.container.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._refresh();
        });
    }

    _getCommand(service, action, type) {
        let command = `systemctl ${action} ${service} --${type}`;
        if (type === 'system' && action !== 'is-active') {
            if (this._settings.get_enum('command-method') === 0)
                command = `pkexec --user root ${command}`;
        }

        return `sh -c "${command}; exit;"`;
    }

    _refresh() {
        this.container.menu.removeAll();

        let restartButton = this._settings.get_boolean('show-restart');

        this._entries.forEach(service => {
            let active = false;
            let [_ok, _out, _err, stat] = GLib.spawn_command_line_sync(
                this._getCommand(service.service, 'is-active', service.type));
            active = stat === 0;

            let serviceItem = new PopupServiceItem(service.name, active, {restartButton});
            this.container.menu.addMenuItem(serviceItem);

            serviceItem.connect('toggled', () => {
                GLib.spawn_command_line_async(
                    this._getCommand(service.service, active ? 'stop' : 'start', service.type));
            });

            if (serviceItem.restartButton) {
                serviceItem.restartButton.connect('clicked', () => {
                    GLib.spawn_command_line_async(
                        this._getCommand(service.service, 'restart', service.type));
                    this.container.menu.close();
                });
            }
        });

        if (this._containerType === 0 && this._settings.get_boolean('show-add')) {
            if (this._entries.length > 0)
                this.container.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let item = new PopupMenu.PopupMenuItem(_('Add systemd services ...'));
            item.connect('activate', () => {
                GLib.spawn_command_line_async(
                    `gnome-extensions prefs ${this._extension.uuid}`);
                this.container.menu.close();
            });
            this.container.menu.addMenuItem(item);
        }

        return true;
    }

    _loadConfig() {
        if (this.container && this._containerType !== this._settings.get_enum('position')) {
            this.container.destroy();
            this._createContainer();
        }

        let externalEntries = this.readJSONConfig('.my_service_list.json');
        let gSettingsEntries = this._settings.get_strv('systemd');

        this._entries = [];

        for (let i = 0; i < gSettingsEntries.length; i++) {
            let entry = JSON.parse(gSettingsEntries[i]);
            if (!('type' in entry))
                entry.type = 'system';
            this._entries.push(entry);
        }

        externalEntries.forEach(externalEntry => {
            let exists = this._entries.some(entry => entry.name === externalEntry.name);
            if (!exists) {
                if (!('type' in externalEntry))
                    externalEntry.type = 'system';
                this._entries.push(externalEntry);
            }
        });
    }

    destroy() {
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = 0;
        }

        if (this.container?.menu && this._menuOpenChangedId) {
            this.container.menu.disconnect(this._menuOpenChangedId);
            this._menuOpenChangedId = 0;
        }

        this.container?.destroy();
        this.container = null;
    }
}

export default class ServicesSystemdExtension extends Extension {
    enable() {
        this._serviceManager = new ServicesManager(this);
    }

    disable() {
        this._serviceManager?.destroy();
        this._serviceManager = null;
    }
}
