import type { Endpoint } from '../../../lib/core';
import { endpoint as editMessage } from './edit';
import { endpoint as updateLastSeen } from './lastSeen';
import { endpoint as listMessages } from './list';
import { endpoint as markMessageRead } from './markRead';
import { endpoint as deleteMessage } from './remove';
import { endpoint as sendMessage } from './send';

const messageEndpoints: Endpoint[] = [
    sendMessage,
    listMessages,
    markMessageRead,
    updateLastSeen,
    editMessage,
    deleteMessage,
];

export default messageEndpoints;
