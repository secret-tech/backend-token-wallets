import { Column } from 'typeorm';
import { intersect, difference } from '../helpers/helpers';
import { getAllAllowedVerifications } from '../services/external/verify.action.service';

export enum Notifications {
  USER_SIGNIN = 'user_signin',
  USER_CHANGE_PASSWORD = 'user_change_password',
  USER_RESET_PASSWORD = 'user_reset_password'
}

export function getAllNotifications() {
  return [
    Notifications.USER_SIGNIN,
    Notifications.USER_CHANGE_PASSWORD,
    Notifications.USER_RESET_PASSWORD
  ];
}

export type BooleanState = { [k: string]: boolean; };

// set true for unknown keys
function setState(allowedKeys: string[], passedState: BooleanState): BooleanState {
  return allowedKeys.reduce((state, name) => {
    state[name] = passedState[name] === undefined || !!passedState[name];
    return state;
  }, {});
}

export class Preferences {
  @Column()
  notifications: BooleanState = {};

  @Column()
  verifications: BooleanState = {};

  setNotifications(notifications: BooleanState) {
    this.notifications = setState(getAllNotifications(), notifications);
  }

  setVerifications(verifications: BooleanState) {
    this.verifications = setState(getAllAllowedVerifications(), verifications);
  }
}
