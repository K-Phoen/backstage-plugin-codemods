import React from 'react';
import {
  StatusError,
  StatusOK,
  StatusPending,
} from '@backstage/core-components';

export const JobStatusColumn = ({ status }: { status: string }) => {
  switch (status) {
    case 'open':
      return <StatusPending>{status}</StatusPending>;
    case 'processing':
      return <StatusPending>{status}</StatusPending>;
    case 'completed':
      return <StatusOK>{status}</StatusOK>;
    case 'error':
    default:
      return <StatusError>{status}</StatusError>;
  }
};
