import { CoreServices, useAuth, useCoreServices } from '../../../core';
import type { AuthenticatedProps } from '../../../core/hooks';
import { compose, res, type Endpoint } from '../../../lib/core';
import { useJsonBody, useKoa, useLogging, usePathParams, useServices } from '../../../lib/hooks';
import { chatIdParamValidator } from '../../chat/schema';
import { sendMessageValidator } from '../schema';
import { useMessageService } from '../service';
import type { MessageService, SendMessageInput } from '../types';

export const sendMessageHandler = async ({
    services,
    args,
}: AuthenticatedProps<SendMessageInput, CoreServices & { messageService: MessageService }>) => {
    const message = await services.messageService.sendMessage({ services, args });
    return res(201, {
        data: { message },
    });
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
        useJsonBody(sendMessageValidator),
        sendMessageHandler,
    ),
    config: {
        method: 'POST',
        path: '/chat/:chatId/message/send',
    },
};
