import type { Endpoint } from '../../../lib/core';
import { endpoint as addMembers } from './addMembers';
import { endpoint as createChat } from './create';
import { endpoint as createGroup } from './createGroup';
import { endpoint as getChatById } from './getById';
import { endpoint as listUserChats } from './listUserChats';
import { endpoint as removeMember } from './removeMember';
import { endpoint as updateGroup } from './updateGroup';

const chatEndpoints: Endpoint[] = [
    createChat,
    createGroup,
    listUserChats,
    getChatById,
    updateGroup,
    addMembers,
    removeMember,
];

export default chatEndpoints;
