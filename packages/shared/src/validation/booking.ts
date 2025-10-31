import Joi from '@hapi/joi';
import {
  getBookingTypeValidationValues,
  getBookingTypeValidationMessage
} from '../config/booking-types.js';

const bookingLocationSchema = Joi.object({
  city: Joi.string().required().min(1).max(100),
  country: Joi.string().required().min(2).max(100),
  coordinates: Joi.array().items(Joi.number()).length(2).optional(),
});

const bookingDateRangeSchema = Joi.object({
  checkIn: Joi.date().required(),
  checkOut: Joi.date().required().greater(Joi.ref('checkIn')),
});

const bookingProviderDetailsSchema = Joi.object({
  provider: Joi.string().required().min(1).max(100),
  confirmationNumber: Joi.string().required().min(1).max(100),
  bookingReference: Joi.string().optional().allow('').max(100),
});

const bookingVerificationSchema = Joi.object({
  status: Joi.string().valid('pending', 'verified', 'failed').required(),
  verifiedAt: Joi.date().optional(),
  documents: Joi.array().items(Joi.string()).required(),
});

const bookingBlockchainSchema = Joi.object({
  transactionId: Joi.string().optional(),
  consensusTimestamp: Joi.string().optional(),
  topicId: Joi.string().required(),
});

export const bookingSchema = Joi.object({
  id: Joi.string().required(),
  userId: Joi.string().required(),
  type: Joi.string().valid(...getBookingTypeValidationValues()).required().messages({
    'any.only': getBookingTypeValidationMessage(),
  }),
  title: Joi.string().required().min(1).max(200),
  description: Joi.string().required().min(1).max(1000),
  location: bookingLocationSchema.required(),
  dateRange: bookingDateRangeSchema.required(),
  originalPrice: Joi.number().positive().required(),
  swapValue: Joi.number().positive().required(),
  providerDetails: bookingProviderDetailsSchema.required(),
  verification: bookingVerificationSchema.required(),
  blockchain: bookingBlockchainSchema.required(),
  status: Joi.string()
    .valid('available', 'locked', 'swapped', 'cancelled')
    .required(),
  createdAt: Joi.date().required(),
  updatedAt: Joi.date().required(),
});

const createBookingDateRangeSchema = Joi.object({
  checkIn: Joi.string().isoDate().required(),
  checkOut: Joi.string().isoDate().required(),
});

// Schema for creating new bookings - only user-provided fields
// System fields (userId, verification, blockchain, status, timestamps) are NOT in this schema
// They are added by the backend after validation
export const createBookingSchema = Joi.object({
  type: Joi.string().valid(...getBookingTypeValidationValues()).required().messages({
    'any.only': getBookingTypeValidationMessage(),
  }),
  title: Joi.string().required().min(1).max(200),
  description: Joi.string().required().min(1).max(1000),
  location: bookingLocationSchema.required(),
  dateRange: createBookingDateRangeSchema.required(),
  originalPrice: Joi.number().positive().required(),
  swapValue: Joi.number().positive().required(),
  providerDetails: bookingProviderDetailsSchema.required(),
});

export const updateBookingSchema = Joi.object({
  title: Joi.string().min(1).max(200).optional(),
  description: Joi.string().min(1).max(1000).optional(),
  swapValue: Joi.number().positive().optional(),
  status: Joi.string()
    .valid('available', 'locked', 'swapped', 'cancelled')
    .optional(),
});
