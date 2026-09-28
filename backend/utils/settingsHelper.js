const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const defaultCompanyProfile = {
  COMPANY_NAME: '',
  COMPANY_ADDRESS: '',
  COMPANY_EMAIL: '',
  COMPANY_PHONE: '',
  COMPANY_WA: '',
  COMPANY_NPWP: '',
  COMPANY_TAX_NAME: '',
  COMPANY_TAX_ADDRESS: '',
  COMPANY_NPWP_16: ''
};

async function getCompanyProfile() {
  try {
    const keys = Object.keys(defaultCompanyProfile);
    const settings = await prisma.appSetting.findMany({
      where: {
        key: { in: keys }
      }
    });

    const profileMap = {};
    settings.forEach(s => {
      profileMap[s.key] = s.value;
    });

    // Merge with defaults
    const profile = {};
    for (const key of keys) {
      profile[key] = (profileMap[key] !== undefined && profileMap[key] !== null && profileMap[key] !== '')
        ? profileMap[key]
        : defaultCompanyProfile[key];
    }
    
    return profile;
  } catch (error) {
    console.error('Error fetching company profile:', error);
    return defaultCompanyProfile;
  }
}

async function getCompanyProfileString() {
  const p = await getCompanyProfile();
  const companyName = p.COMPANY_NAME || 'Perusahaan';
  const lines = [
    'Profil Perusahaan:',
    `Nama Perusahaan: ${companyName}`
  ];
  if (p.COMPANY_ADDRESS) lines.push(`Alamat: ${p.COMPANY_ADDRESS}`);
  if (p.COMPANY_EMAIL) lines.push(`Email: ${p.COMPANY_EMAIL}`);
  if (p.COMPANY_PHONE) lines.push(`No Telpon: ${p.COMPANY_PHONE}`);
  if (p.COMPANY_WA) lines.push(`No WhatsApp: ${p.COMPANY_WA}`);
  if (p.COMPANY_NPWP) lines.push(`NPWP: ${p.COMPANY_NPWP}`);
  if (p.COMPANY_TAX_NAME && p.COMPANY_TAX_NAME.trim() && p.COMPANY_TAX_NAME !== companyName) {
    lines.push(`Nama WP: ${p.COMPANY_TAX_NAME}`);
  }
  if (p.COMPANY_TAX_ADDRESS) lines.push(`Alamat WP: ${p.COMPANY_TAX_ADDRESS}`);
  if (p.COMPANY_NPWP_16) lines.push(`NPWP 16 Digit: ${p.COMPANY_NPWP_16}`);
  return lines.join('\n');
}

module.exports = {
  getCompanyProfile,
  getCompanyProfileString,
  defaultCompanyProfile
};
