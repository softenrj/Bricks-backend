import { Response } from "express"

class ARCH_SSE_MANAGER {
    private clients = new Map<string, Response>();

    _add(jobId: string, res: Response) {
        this.clients.set(jobId, res);
    }

    _remove(jobId: string) {
        this.clients.delete(jobId);
    }

    send(jobId: string, event: string, data: any) {
        const client = this.clients.get(jobId)!;
        if (!client) return;

        client.write(`event: ${event}\n`);
        client.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    complete(jobId: string) {
        const client = this.clients.get(jobId);
        if (!client) return;

        client.write(`event: complete\n`);
        client.write(`data: done\n\n`);
        client.end();
        this.clients.delete(jobId);
    }
}

export const archSSEmanager = new ARCH_SSE_MANAGER();