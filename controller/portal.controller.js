const portal = require('../model/portal.model.js')
const mapValue = (value) => (value === "missing" ? 0 : 1);

function map(headerStatusData){
  return {
  ContentSecurityPolicy: mapValue(headerStatusData["Content-Security-Policy"]),
  CrossOriginOpenerPolicy: mapValue(headerStatusData["Cross-Origin-Opener-Policy"]),
  CacheControl: mapValue(headerStatusData["Cache-Control"]),
  PermissionsPolicy: mapValue(headerStatusData["Permissions-Policy"]),
  ReferrerPolicy: mapValue(headerStatusData["Referrer-Policy"]),
  StrictTransportSecurity: mapValue(headerStatusData["Strict-Transport-Security"]),
  XContentTypeOptions: mapValue(headerStatusData["X-Content-Type-Options"]),

  XFrameOptions: mapValue(headerStatusData["X-Frame-Options"]),
  XXSSProtection: mapValue(headerStatusData["X-XSS-Protection"]),
  };
  return 
}

const savetoDB = async (data)=>{
  data.headerStatus = map(data.headerStatus)
    console.log(data)
  try {
    const prev = await portal.findOne({ portalName: data.portalName });
    if(prev){
      return true
    }
    const record = await portal.create(data)
    console.log(record)
    return true
  } catch (error) {
    console.log("error while saving data");
    return false
  }
}
module.exports = savetoDB