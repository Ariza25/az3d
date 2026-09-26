import React from 'react';
import { AdminModalContainer, AdminModalContainerProps } from '../features/admin/AdminModalContainer';

export type AdminModalProps = AdminModalContainerProps;

export const AdminModal: React.FC<AdminModalProps> = (props) => {
  return <AdminModalContainer {...props} />;
};

export default AdminModal;
