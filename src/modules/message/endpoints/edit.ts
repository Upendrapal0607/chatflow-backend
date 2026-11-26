import { CoreServices, useAuth, useCoreServices } from '../../../core';
import type { AuthenticatedProps } from '../../../core/hooks';
import { compose, type Endpoint } from '../../../lib/core';
import { useJsonBody, useKoa, useLogging, usePathParams, useServices } from '../../../lib/hooks';
import { editMessageValidator, messageIdParamValidator } from '../schema';
import { useMessageService } from '../service';
import type { EditMessageInput, MessageService } from '../types';

export const editMessageHandler = async ({
    services,
    args,
}: AuthenticatedProps<EditMessageInput, CoreServices & { messageService: MessageService }>) => {
    const message = await services.messageService.editMessage({ services, args });
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
        useJsonBody(editMessageValidator),
        editMessageHandler,
    ),
    config: {
        method: 'PATCH',
        path: '/chat/:chatId/message/:messageId',
    },
};
