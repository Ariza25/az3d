import React from 'react';
import { UserSettingsContainer, UserSettingsContainerProps } from '../features/user-settings';

export type UserSettingsModalProps = UserSettingsContainerProps;

export const UserSettingsModal: React.FC<UserSettingsModalProps> = (props) => {
  return <UserSettingsContainer {...props} />;
};

export default UserSettingsModal;
