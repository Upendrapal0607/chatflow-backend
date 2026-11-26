import { CoreServices, useAuth, useCoreServices } from '../../../core';
import type { AuthenticatedProps } from '../../../core/hooks';
import { compose, type Endpoint } from '../../../lib/core';
import { useKoa, useLogging, usePathParams, useServices } from '../../../lib/hooks';
import { messageIdParamValidator } from '../schema';
import { useMessageService } from '../service';
import type { DeleteMessageInput, MessageService } from '../types';

export const deleteMessageHandler = async ({
    services,
    args,
}: AuthenticatedProps<DeleteMessageInput, CoreServices & { messageService: MessageService }>) => {
    const message = await services.messageService.deleteMessage({ services, args });
    return {
        data: { message },
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
        usePathParams(messageIdParamValidator),
        deleteMessageHandler,
    ),
    config: {
        method: 'DELETE',
        path: '/chat/:chatId/message/:messageId',
    },
};
