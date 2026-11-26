import { CoreServices, useAuth, useCoreServices } from '../../../core';
import type { AuthenticatedProps } from '../../../core/hooks';
import { compose, res, type Endpoint } from '../../../lib/core';
import { useJsonBody, useKoa, useLogging, useServices } from '../../../lib/hooks';
import { createGroupChatValidator } from '../schema';
import { useChatService } from '../service';
import type { ChatService, CreateGroupChatInput } from '../types';

export const createGroupChatHandler = async ({
    services,
    args,
}: AuthenticatedProps<CreateGroupChatInput, CoreServices & { chatService: ChatService }>) => {
    const chat = await services.chatService.createGroupChat({ services, args });
    return res(201, {
        data: {
            chatId: chat.chatId,
            chat,
        },
    });
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
        useJsonBody(createGroupChatValidator),
        createGroupChatHandler,
    ),
    config: {
        method: 'POST',
        path: '/chat/group/create',
    },
};
