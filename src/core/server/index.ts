export const registerShutdown = (cleanup: () => void): void => {
    let shuttingDown = false;
    const handleSignal = () => {
        if (shuttingDown) {
            return;
        }
        shuttingDown = true;
        cleanup();
    };

    process.on('SIGTERM', handleSignal);
    process.on('SIGINT', handleSignal);
};
