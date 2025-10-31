import Joi from '@hapi/joi';
import {
  getBookingTypeValidationValues,
  getBookingTypeValidationMessage
} from '../config/booking-types.js';

const swapCriteriaSchema = Joi.object({
  maxAdditionalPayment: Joi.number().min(0).optional(),
  preferredLocations: Joi.array().items(Joi.string().min(1).max(100)).optional(),
  bookingTypes: Joi.array().items(Joi.string().valid(...getBookingTypeValidationValues())).optional().messages({
    'any.only': getBookingTypeValidationMessage(),
  })
});

const userPreferencesSchema = Joi.object({
  notifications: Joi.boolean().required(),
  autoAcceptCriteria: swapCriteriaSchema.optional()
});

const userProfileSchema = Joi.object({
  displayName: Joi.string().min(1).max(100).optional(),
  email: Joi.string().email({ tlds: false }).optional(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
  preferences: userPreferencesSchema.required()
});

const userVerificationSchema = Joi.object({
  level: Joi.string().valid('basic', 'verified', 'premium').required(),
  documents: Joi.array().items(Joi.string()).required(),
  verifiedAt: Joi.date().optional()
});

const reviewSchema = Joi.object({
  id: Joi.string().required(),
  reviewerId: Joi.string().required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(1000).optional(),
  swapId: Joi.string().required(),
  createdAt: Joi.date().required()
});

const userReputationSchema = Joi.object({
  score: Joi.number().min(0).max(5).required(),
  completedSwaps: Joi.number().integer().min(0).required(),
  cancelledSwaps: Joi.number().integer().min(0).required(),
  reviews: Joi.array().items(reviewSchema).required()
});

export const userSchema = Joi.object({
  id: Joi.string().required(),
  walletAddress: Joi.string().required().pattern(/^0\.0\.\d+$/), // Hedera account ID format
  profile: userProfileSchema.required(),
  verification: userVerificationSchema.required(),
  reputation: userReputationSchema.required(),
  lastActiveAt: Joi.date().required(),
  createdAt: Joi.date().required(),
  updatedAt: Joi.date().required()
});

export const createUserSchema = userSchema.fork(['id', 'createdAt', 'updatedAt', 'lastActiveAt'], (schema) =>
  schema.optional()
);

export const updateUserProfileSchema = Joi.object({
  displayName: Joi.string().min(1).max(100).optional(),
  email: Joi.string().email({ tlds: false }).optional(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
  preferences: userPreferencesSchema.optional()
});