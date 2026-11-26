import { CoreServices, useAuth, useCoreServices } from '../../../core';
import type { AuthenticatedProps } from '../../../core/hooks';
import { compose, type Endpoint } from '../../../lib/core';
import { useJsonBody, useKoa, useLogging, usePathParams, useServices } from '../../../lib/hooks';
import { chatIdParamValidator, updateGroupChatValidator } from '../schema';
import { useChatService } from '../service';
import type { ChatService, UpdateGroupChatInput } from '../types';

export const updateGroupChatHandler = async ({
    services,
    args,
}: AuthenticatedProps<UpdateGroupChatInput, CoreServices & { chatService: ChatService }>) => {
    const chat = await services.chatService.updateGroupChat({ services, args });
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
        useJsonBody(updateGroupChatValidator),
        updateGroupChatHandler,
    ),
    config: {
        method: 'PATCH',
        path: '/chat/:chatId',
    },
};
