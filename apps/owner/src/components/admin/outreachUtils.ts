/**
 * Utility functions for 100% Free Bulk WhatsApp and Email Outreach in Admin Panel
 */

export const cleanWhatsAppNumber = (phoneStr: string, defaultCountry = '91'): string => {
  if (!phoneStr) return '';
  let cleaned = phoneStr.replace(/\D/g, '');
  
  // If starts with 0 and length is 11 (e.g. 09876543210 in India), remove leading 0
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }
  
  // If 10 digits (standard Indian mobile e.g. 9876543210), prefix with defaultCountry code
  if (cleaned.length === 10) {
    cleaned = defaultCountry + cleaned;
  }
  
  return cleaned;
};

export const replacePlaceholders = (
  template: string, 
  tenant: any, 
  extras: { link?: string; imageUrl?: string } = {}
): string => {
  if (!template) return '';
  const businessName = tenant.businessName || 'Your Kitchen';
  const ownerName = tenant.ownerName || 'Kitchen Partner';
  const planName = tenant.planName || 'ScaleKitchen Plan';
  const expiryDate = tenant.planExpiryDate || 'Active';
  const daysLeft = tenant.daysLeft != null ? String(tenant.daysLeft) : 'Active';
  const mobile = tenant.mobile || '';
  const email = tenant.email || '';
  const link = extras.link || window.location.origin;
  const imageUrl = extras.imageUrl || '';

  return template
    .replace(/\{\{businessName\}\}/gi, businessName)
    .replace(/\{businessName\}/gi, businessName)
    .replace(/\{\{ownerName\}\}/gi, ownerName)
    .replace(/\{ownerName\}/gi, ownerName)
    .replace(/\{\{planName\}\}/gi, planName)
    .replace(/\{planName\}/gi, planName)
    .replace(/\{\{expiryDate\}\}/gi, expiryDate)
    .replace(/\{expiryDate\}/gi, expiryDate)
    .replace(/\{\{daysLeft\}\}/gi, daysLeft)
    .replace(/\{daysLeft\}/gi, daysLeft)
    .replace(/\{\{mobile\}\}/gi, mobile)
    .replace(/\{mobile\}/gi, mobile)
    .replace(/\{\{email\}\}/gi, email)
    .replace(/\{email\}/gi, email)
    .replace(/\{\{link\}\}/gi, link)
    .replace(/\{link\}/gi, link)
    .replace(/\{\{imageUrl\}\}/gi, imageUrl)
    .replace(/\{imageUrl\}/gi, imageUrl);
};

export const convertBlobToPng = (blob: Blob): Promise<Blob> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(blob);
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((b) => {
        URL.revokeObjectURL(url);
        if (b) resolve(b);
        else resolve(blob);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    img.src = url;
  });
};

export const copyImageToClipboard = async (imageUrl: string): Promise<{ success: boolean; message: string }> => {
  if (!imageUrl) return { success: false, message: 'No image URL provided' };

  try {
    const res = await fetch(imageUrl, { mode: 'cors' });
    const blob = await res.blob();
    const pngBlob = blob.type === 'image/png' ? blob : await convertBlobToPng(blob);

    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob })
      ]);
      return { success: true, message: 'Image copied to clipboard! Paste directly (Ctrl+V) into WhatsApp or Email.' };
    }
  } catch (err) {
    console.warn("Direct blob clipboard write failed, trying fallback copy:", err);
  }

  // Fallback: copy image URL
  try {
    await navigator.clipboard.writeText(imageUrl);
    return { success: true, message: 'Image link copied to clipboard! You can paste this link or open and save the image.' };
  } catch {
    return { success: false, message: 'Could not access clipboard. Please copy manually.' };
  }
};

export const copyRichEmailToClipboard = async (
  html: string, 
  plainText: string
): Promise<{ success: boolean; message: string }> => {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const htmlBlob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob
        })
      ]);
      return { 
        success: true, 
        message: 'Rich formatted email copied! Open Gmail or Outlook compose and press Ctrl+V to paste with styling & images.' 
      };
    } else {
      await navigator.clipboard.writeText(plainText);
      return { 
        success: true, 
        message: 'Plain text email copied to clipboard.' 
      };
    }
  } catch (e) {
    console.warn("Clipboard rich HTML write failed:", e);
    try {
      await navigator.clipboard.writeText(plainText);
      return { success: true, message: 'Plain text email copied to clipboard.' };
    } catch {
      return { success: false, message: 'Clipboard access denied.' };
    }
  }
};

export const launchGmailWebBcc = (bccEmails: string[], subject: string, bodyText: string) => {
  // Join BCC addresses (comma separated)
  const bccStr = bccEmails.filter(Boolean).join(',');
  const url = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(bccStr)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

export const launchMailtoBcc = (bccEmails: string[], subject: string, bodyText: string) => {
  const bccStr = bccEmails.filter(Boolean).join(',');
  const mailtoUrl = `mailto:?bcc=${encodeURIComponent(bccStr)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
  window.location.href = mailtoUrl;
};

export const exportWhatsAppCsv = (
  items: { name: string; business: string; phone: string; message: string }[]
) => {
  const headers = ['Business Name', 'Owner Name', 'Phone', 'Clean WhatsApp Number', 'Personalized Message'];
  const rows = items.map(item => [
    `"${(item.business || '').replace(/"/g, '""')}"`,
    `"${(item.name || '').replace(/"/g, '""')}"`,
    `"${item.phone || ''}"`,
    `"${cleanWhatsAppNumber(item.phone)}"`,
    `"${(item.message || '').replace(/"/g, '""')}"`
  ]);
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `whatsapp_bulk_contacts_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
