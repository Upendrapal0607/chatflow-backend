import { CoreServices, useAuth, useCoreServices } from '../../../core';
import type { AuthenticatedProps } from '../../../core/hooks';
import { compose, type Endpoint } from '../../../lib/core';
import { useJsonBody, useKoa, useLogging, usePathParams, useServices } from '../../../lib/hooks';
import { markMessageReadValidator, messageIdParamValidator } from '../schema';
import { useMessageService } from '../service';
import type { MarkMessageReadInput, MessageService } from '../types';

export const markMessageReadHandler = async ({
    services,
    args,
}: AuthenticatedProps<MarkMessageReadInput, CoreServices & { messageService: MessageService }>) => {
    const receipt = await services.messageService.markMessageRead({ services, args });
    return {
        data: { receipt },
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
        useJsonBody(markMessageReadValidator),
        markMessageReadHandler,
    ),
    config: {
        method: 'POST',
        path: '/chat/:chatId/message/:messageId/read',
    },
};
