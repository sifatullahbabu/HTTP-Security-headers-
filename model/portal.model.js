const mongoose = require('mongoose');

// Define the schema for headerStatus
const headerStatusSchema = new mongoose.Schema({
  ContentSecurityPolicy: { type: Number, default: 0 },
  CrossOriginOpenerPolicy: { type: Number, default: 0 },
  PermissionsPolicy: { type: Number, default: 0 },
  ReferrerPolicy: { type: Number, default: 0 },
  StrictTransportSecurity: { type: Number, default: 0 },
  XContentTypeOptions: { type: Number, default: 0 },
  XFrameOptions: { type: Number, default: "SAMEORIGIN" },
  XXSSProtection: { type: Number, default: "0" },
 SetCookieAttributes: { type: Number, default: 0 }
}, { _id: false }); // Disable _id for nested schema

// Define the main schema
const portalSchema = new mongoose.Schema({
  portalName: { type: String, required: true },
  headerStatus: { type: headerStatusSchema, default: () => ({}) },
});

// Create the model
const Portal = mongoose.model('Portal', portalSchema);

module.exports = Portal;
