import { CoreServices, useAuth, useCoreServices } from '../../../core';
import type { AuthenticatedProps } from '../../../core/hooks';
import { compose, type Endpoint } from '../../../lib/core';
import { useKoa, useLogging, usePathParams, useServices } from '../../../lib/hooks';
import { chatMemberParamValidator } from '../schema';
import { useChatService } from '../service';
import type { ChatService, RemoveChatMemberInput } from '../types';

export const removeChatMemberHandler = async ({
    services,
    args,
}: AuthenticatedProps<RemoveChatMemberInput, CoreServices & { chatService: ChatService }>) => {
    const chat = await services.chatService.removeMember({ services, args });
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
        usePathParams(chatMemberParamValidator),
        removeChatMemberHandler,
    ),
    config: {
        method: 'DELETE',
        path: '/chat/:chatId/members/:userId',
    },
};
