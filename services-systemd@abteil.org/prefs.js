import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const ServicesSystemdPrefsWidget = GObject.registerClass(
class ServicesSystemdPrefsWidget extends Gtk.Box {
    constructor(settings) {
        super({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 16,
            margin_top: 20,
            margin_bottom: 20,
            margin_start: 20,
            margin_end: 20,
        });

        this._settings = settings;

        let title = new Gtk.Label({
            label: _('Services Systemd'),
            halign: Gtk.Align.START,
        });
        title.add_css_class('title-2');
        this.append(title);

        let info = new Gtk.Label({
            label: _('Edit one service per line as: Label|service.name|system-or-user'),
            wrap: true,
            halign: Gtk.Align.START,
            xalign: 0,
        });
        info.add_css_class('dim-label');
        this.append(info);

        this.append(this._buildSwitchRow(_('Show add services'), 'show-add'));
        this.append(this._buildSwitchRow(_('Show restart button'), 'show-restart'));
        this.append(this._buildDropDownRow(
            _('Position'),
            ['Panel', 'Menu'],
            this._settings.get_enum('position'),
            selected => this._settings.set_enum('position', selected)
        ));
        this.append(this._buildDropDownRow(
            _('Command method'),
            ['pkexec', 'systemctl'],
            this._settings.get_enum('command-method'),
            selected => this._settings.set_enum('command-method', selected)
        ));

        let servicesLabel = new Gtk.Label({
            label: _('Services'),
            halign: Gtk.Align.START,
            xalign: 0,
            margin_top: 8,
        });
        servicesLabel.add_css_class('heading');
        this.append(servicesLabel);

        this._buffer = new Gtk.TextBuffer();
        this._buffer.set_text(this._serializeServices(), -1);

        let textView = new Gtk.TextView({
            buffer: this._buffer,
            monospace: true,
            wrap_mode: Gtk.WrapMode.NONE,
            vexpand: true,
        });

        let scrolled = new Gtk.ScrolledWindow({
            min_content_height: 260,
            vexpand: true,
            hexpand: true,
        });
        scrolled.set_child(textView);
        this.append(scrolled);

        let buttonRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
        });

        let saveButton = new Gtk.Button({
            label: _('Save services'),
            halign: Gtk.Align.START,
        });
        saveButton.connect('clicked', () => this._saveServices());
        buttonRow.append(saveButton);

        this._statusLabel = new Gtk.Label({
            halign: Gtk.Align.START,
            xalign: 0,
        });
        this._statusLabel.add_css_class('dim-label');
        buttonRow.append(this._statusLabel);

        this.append(buttonRow);
    }

    _buildSwitchRow(labelText, key) {
        let row = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
        });

        let label = new Gtk.Label({
            label: labelText,
            halign: Gtk.Align.START,
            hexpand: true,
            xalign: 0,
        });

        let toggle = new Gtk.Switch();
        this._settings.bind(key, toggle, 'active', Gio.SettingsBindFlags.DEFAULT);

        row.append(label);
        row.append(toggle);

        return row;
    }

    _buildDropDownRow(labelText, items, selected, onChanged) {
        let row = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
        });

        let label = new Gtk.Label({
            label: labelText,
            halign: Gtk.Align.START,
            hexpand: true,
            xalign: 0,
        });

        let dropdown = Gtk.DropDown.new_from_strings(items);
        dropdown.set_selected(selected);
        dropdown.connect('notify::selected', widget => {
            onChanged(widget.get_selected());
        });

        row.append(label);
        row.append(dropdown);

        return row;
    }

    _serializeServices() {
        return this._settings.get_strv('systemd').map(item => {
            let entry = JSON.parse(item);
            return `${entry.name}|${entry.service}|${entry.type ?? 'system'}`;
        }).join('\n');
    }

    _saveServices() {
        let start = this._buffer.get_start_iter();
        let end = this._buffer.get_end_iter();
        let text = this._buffer.get_text(start, end, false);
        let lines = text.split('\n');
        let items = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line)
                continue;

            let parts = line.split('|');
            if (parts.length !== 3) {
                this._statusLabel.set_text(_('Invalid line format.'));
                return;
            }

            let name = parts[0].trim();
            let service = parts[1].trim();
            let type = parts[2].trim();

            if (!name || !service || (type !== 'system' && type !== 'user')) {
                this._statusLabel.set_text(_('Each line must be Label|service|system or user.'));
                return;
            }

            items.push(JSON.stringify({name, service, type}));
        }

        this._settings.set_strv('systemd', items);
        this._statusLabel.set_text(_('Saved.'));
    }
});

export default class ServicesSystemdPreferences extends ExtensionPreferences {
    getPreferencesWidget() {
        return new ServicesSystemdPrefsWidget(this.getSettings());
    }
}
