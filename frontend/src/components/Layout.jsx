import React from 'react';
import { Sidebar } from './Sidebar';
import { AiChatBox } from './AiChatBox';

export const Layout = ({ children, publicTenantName }) => {
  return (
    <div className="layout-container">
      <Sidebar publicTenantName={publicTenantName} />
      <div className="main-content">
        {children}
      </div>
      <AiChatBox />
    </div>
  );
};

