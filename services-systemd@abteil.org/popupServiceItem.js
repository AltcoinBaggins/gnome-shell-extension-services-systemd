import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

export const PopupServiceItem = GObject.registerClass(
class PopupServiceItem extends PopupMenu.PopupSwitchMenuItem {
    _init(text, active, params = {}) {
        super._init(text, active);

        if (params.restartButton) {
            this.restartButton = new St.Button({
                x_align: Clutter.ActorAlign.END,
                x_expand: false,
                reactive: true,
                can_focus: true,
                track_hover: true,
                accessible_name: 'restart',
                style_class: 'system-menu-action services-systemd-button-reload',
            });

            this.restartButton.child = new St.Icon({icon_name: 'view-refresh-symbolic'});
            this.add_child(this.restartButton);
        }
    }
});
