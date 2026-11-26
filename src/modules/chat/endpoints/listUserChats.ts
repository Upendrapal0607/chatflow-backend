import { CoreServices, useAuth, useCoreServices } from '../../../core';
import type { AuthenticatedProps } from '../../../core/hooks';
import { compose, type Endpoint } from '../../../lib/core';
import { useKoa, useLogging, usePathParams, useServices } from '../../../lib/hooks';
import { userIdParamValidator } from '../../user/schema';
import { useChatService } from '../service';
import type { ChatService } from '../types';

export const listUserChatsHandler = async ({
    services,
    args,
}: AuthenticatedProps<{ userId: string }, CoreServices & { chatService: ChatService }>) => {
    const chats = await services.chatService.listUserChats({ services, args });
    return {
        data: {
            chats,
        },
    };
};

export const endpoint: Endpoint = {
    handler: compose(
        useKoa(),
        useServices({
            ...useCoreServices(),
            ...useChatService(),
        }),
        useLogging(),
        useAuth(),
        usePathParams(userIdParamValidator),
        listUserChatsHandler,
    ),
    config: {
        method: 'GET',
        path: '/user/:userId/chats',
    },
};
