import { CoreServices, useAuth, useCoreServices } from '../../../core';
import type { AuthenticatedProps } from '../../../core/hooks';
import { compose, type Endpoint } from '../../../lib/core';
import { useJsonBody, useKoa, useLogging, usePathParams, useServices } from '../../../lib/hooks';
import { addChatMembersValidator, chatIdParamValidator } from '../schema';
import { useChatService } from '../service';
import type { AddChatMembersInput, ChatService } from '../types';

export const addChatMembersHandler = async ({
    services,
    args,
}: AuthenticatedProps<AddChatMembersInput, CoreServices & { chatService: ChatService }>) => {
    const chat = await services.chatService.addMembers({ services, args });
    return {
        data: { chat },
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
        usePathParams(chatIdParamValidator),
        useJsonBody(addChatMembersValidator),
        addChatMembersHandler,
    ),
    config: {
        method: 'POST',
        path: '/chat/:chatId/members',
    },
};
