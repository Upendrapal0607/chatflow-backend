import { CoreServices, useAuth, useCoreServices } from '../../../core';
import type { AuthenticatedProps } from '../../../core/hooks';
import { compose, res, type Endpoint } from '../../../lib/core';
import { useJsonBody, useKoa, useLogging, useServices } from '../../../lib/hooks';
import { createDirectChatValidator } from '../schema';
import { useChatService } from '../service';
import type { ChatService, CreateDirectChatInput } from '../types';

export const createChatHandler = async ({
    services,
    args,
}: AuthenticatedProps<CreateDirectChatInput, CoreServices & { chatService: ChatService }>) => {
    const result = await services.chatService.createOrGetDirectChat({ services, args });
    return res(result.created ? 201 : 200, { data: result });
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
        useJsonBody(createDirectChatValidator),
        createChatHandler,
    ),
    config: {
        method: 'POST',
        path: '/chat/create',
    },
};
