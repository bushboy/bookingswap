import Joi from '@hapi/joi';

const swapTermsSchema = Joi.object({
  additionalPayment: Joi.number().min(0).optional(),
  conditions: Joi.array().items(Joi.string().min(1).max(500)).required(),
  expiresAt: Joi.date().required()
});

const swapBlockchainSchema = Joi.object({
  proposalTransactionId: Joi.string().required(),
  executionTransactionId: Joi.string().optional(),
  escrowContractId: Joi.string().optional()
});

const swapTimelineSchema = Joi.object({
  proposedAt: Joi.date().required(),
  respondedAt: Joi.date().optional(),
  completedAt: Joi.date().optional()
});

export const swapSchema = Joi.object({
  id: Joi.string().required(),
  sourceBookingId: Joi.string().required(),
  targetBookingId: Joi.string().required(),
  proposerId: Joi.string().required(),
  ownerId: Joi.string().required(),
  status: Joi.string().valid('pending', 'accepted', 'rejected', 'completed', 'cancelled').required(),
  terms: swapTermsSchema.required(),
  blockchain: swapBlockchainSchema.required(),
  timeline: swapTimelineSchema.required(),
  createdAt: Joi.date().required(),
  updatedAt: Joi.date().required()
});

const createSwapTermsSchema = Joi.object({
  additionalPayment: Joi.number().min(0).optional(),
  conditions: Joi.array().items(Joi.string().min(1).max(500)).required(),
  expiresAt: Joi.date().required().min('now')
});

export const createSwapSchema = swapSchema.fork(['id', 'createdAt', 'updatedAt'], (schema) => 
  schema.optional()
).fork(['terms'], () => createSwapTermsSchema);

export const updateSwapStatusSchema = Joi.object({
  status: Joi.string().valid('accepted', 'rejected', 'cancelled').required()
});