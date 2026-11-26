import { CoreServices, useAuth, useCoreServices } from '../../../core';
import type { AuthenticatedProps } from '../../../core/hooks';
import { compose, type Endpoint } from '../../../lib/core';
import { useJsonBody, useKoa, useLogging, usePathParams, useServices } from '../../../lib/hooks';
import { chatIdParamValidator } from '../../chat/schema';
import { updateLastSeenValidator } from '../schema';
import { useMessageService } from '../service';
import type { MessageService, UpdateLastSeenInput } from '../types';

export const updateLastSeenHandler = async ({
    services,
    args,
}: AuthenticatedProps<UpdateLastSeenInput, CoreServices & { messageService: MessageService }>) => {
    const lastSeen = await services.messageService.updateLastSeen({ services, args });
    return {
        data: { lastSeen },
    };
};

export const endpoint: Endpoint = {
    handler: compose(
        useKoa(),
        useServices({
            ...useCoreServices(),
            ...useMessageService(),
        }),
        useLogging(),
        useAuth(),
        usePathParams(chatIdParamValidator),
        useJsonBody(updateLastSeenValidator),
        updateLastSeenHandler,
    ),
    config: {
        method: 'POST',
        path: '/chat/:chatId/lastseen',
    },
};
