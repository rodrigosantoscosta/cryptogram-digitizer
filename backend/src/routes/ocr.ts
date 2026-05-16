import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OCRService } from '../services/ocrService';

export async function ocrRoutes(fastify: FastifyInstance) {
  const ocrService = new OCRService();

  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = await ocrService.healthCheck();
      return reply.send(health);
    } catch (error) {
      fastify.log.error(`Health check failed: ${error}`);
      return reply.status(503).send({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  fastify.post('/ocr/cell', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const buffer = await data.toBuffer();
      const result = await ocrService.recognizeCell(buffer, data.mimetype);
      return reply.send(result);
    } catch (error) {
      fastify.log.error(`OCR cell failed: ${error}`);
      return reply.status(500).send({
        error: 'OCR processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  fastify.post('/ocr/batch', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parts = request.files();
      const images: { data: Buffer; mimeType: string }[] = [];

      for await (const part of parts) {
        images.push({
          data: await part.toBuffer(),
          mimeType: part.mimetype,
        });
      }

      if (images.length === 0) {
        return reply.status(400).send({ error: 'No files uploaded' });
      }

      const results = await ocrService.recognizeBatchWithChunking(images);
      return reply.send({ results });
    } catch (error) {
      fastify.log.error(`OCR batch failed: ${error}`);
      return reply.status(500).send({
        error: 'OCR batch processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
