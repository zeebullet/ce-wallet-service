import { Storage } from '@google-cloud/storage';
import PDFDocument from 'pdfkit';
import db from '../db';
import { config } from '../config';
import { logger } from '../utils/logger';

// Initialize GCS client
let storage: Storage;
if (config.gcp.useDefaultCredentials) {
  storage = new Storage();
} else {
  storage = new Storage({
    keyFilename: config.gcp.keyFile,
  });
}

const bucket = storage.bucket(config.gcp.bucket);
const INVOICE_FOLDER = 'invoices';

// ============ INTERFACES ============

interface BrandInfo {
  name: string;
  address?: string;
  pan?: string;
  gst_number?: string;
  state?: string;
  state_code?: string;
}

export interface GenerateBrandPurchaseInvoiceInput {
  transaction_id: string;
  brand_id: string;
  amount: number;
  brand: BrandInfo;
  package_name: string;
  tokens: number;
  package_type?: string;
}

export interface GenerateEscrowDepositInvoiceInput {
  transaction_id: string;
  brand_id: string;
  amount: number;
  brand: BrandInfo;
  campaign_name?: string;
}

export interface InvoiceResult {
  invoice_number: string;
  invoice_pdf_url: string;
}

// ============ INVOICE NUMBER GENERATION ============

/**
 * Generate a unique invoice number
 * Format: INV-YYYYMMDD-XXXXXX (where XXXXXX is a sequential number)
 */
async function generateInvoiceNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Get the count of invoices for today to generate sequential number
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  
  const countResult = await db('brand_transactions')
    .whereNotNull('invoice_number')
    .where('created_at', '>=', todayStart)
    .where('created_at', '<', todayEnd)
    .count('id as count')
    .first();
  
  const count = parseInt((countResult?.count as string) || '0', 10) + 1;
  const sequentialNum = count.toString().padStart(6, '0');
  
  return `INV-${dateStr}-${sequentialNum}`;
}

// ============ HTML TEMPLATE GENERATION ============

/**
 * Generate HTML for brand token/subscription purchase invoice
 */
function generateBrandPurchaseInvoiceHTML(data: {
  invoice_number: string;
  invoice_date: string;
  brand: BrandInfo;
  package_name: string;
  tokens: number;
  package_type: string;
  amount: number;
  gst_amount: number;
  total_amount: number;
  transaction_id: string;
}): string {
  const {
    invoice_number,
    invoice_date,
    brand,
    package_name,
    tokens,
    package_type,
    amount,
    gst_amount,
    total_amount,
    transaction_id,
  } = data;

  const isIntraState = brand.state_code === '27'; // Maharashtra state code
  const cgstAmount = isIntraState ? gst_amount / 2 : 0;
  const sgstAmount = isIntraState ? gst_amount / 2 : 0;
  const igstAmount = isIntraState ? 0 : gst_amount;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Helvetica', 'Arial', sans-serif;
      font-size: 12px;
      color: #333;
      line-height: 1.4;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 30px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      border-bottom: 2px solid #4f46e5;
      padding-bottom: 20px;
    }
    .company-info h1 {
      font-size: 28px;
      color: #4f46e5;
      margin-bottom: 5px;
    }
    .company-info p {
      font-size: 11px;
      color: #666;
    }
    .invoice-title {
      text-align: right;
    }
    .invoice-title h2 {
      font-size: 24px;
      color: #333;
      margin-bottom: 10px;
    }
    .invoice-title p {
      font-size: 11px;
      color: #666;
    }
    .invoice-details {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .bill-to, .invoice-info {
      width: 48%;
    }
    .bill-to h3, .invoice-info h3 {
      font-size: 14px;
      color: #4f46e5;
      margin-bottom: 10px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 5px;
    }
    .bill-to p, .invoice-info p {
      margin-bottom: 3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background-color: #4f46e5;
      color: white;
      padding: 12px 10px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
    }
    td {
      padding: 12px 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:nth-child(even) {
      background-color: #f9fafb;
    }
    .totals {
      width: 300px;
      margin-left: auto;
    }
    .totals table {
      margin-bottom: 0;
    }
    .totals td {
      padding: 8px 10px;
    }
    .totals tr:last-child td {
      font-weight: bold;
      font-size: 14px;
      background-color: #4f46e5;
      color: white;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 10px;
      color: #666;
    }
    .terms {
      margin-top: 30px;
      padding: 15px;
      background-color: #f9fafb;
      border-radius: 5px;
    }
    .terms h4 {
      font-size: 12px;
      margin-bottom: 8px;
      color: #333;
    }
    .terms p {
      font-size: 10px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="company-info">
        <h1>Hippi</h1>
        <p>Hippi Technology Pvt. Ltd.</p>
        <p>Mumbai, Maharashtra - 400001</p>
        <p>GSTIN: 27AABCH1234D1Z5</p>
      </div>
      <div class="invoice-title">
        <h2>TAX INVOICE</h2>
        <p>Invoice #: ${invoice_number}</p>
        <p>Date: ${invoice_date}</p>
      </div>
    </div>

    <div class="invoice-details">
      <div class="bill-to">
        <h3>Bill To</h3>
        <p><strong>${brand.name}</strong></p>
        ${brand.address ? `<p>${brand.address}</p>` : ''}
        ${brand.gst_number ? `<p>GSTIN: ${brand.gst_number}</p>` : ''}
        ${brand.pan ? `<p>PAN: ${brand.pan}</p>` : ''}
        ${brand.state ? `<p>State: ${brand.state}</p>` : ''}
      </div>
      <div class="invoice-info">
        <h3>Transaction Details</h3>
        <p><strong>Transaction ID:</strong> ${transaction_id}</p>
        <p><strong>Payment Method:</strong> Online (Razorpay)</p>
        <p><strong>Status:</strong> Paid</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>HSN/SAC</th>
          <th>Qty</th>
          <th>Rate</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${package_name}</strong><br>
            <small>${package_type === 'subscription' ? 'Subscription Package' : 'Token Top-up Package'}</small><br>
            <small>${tokens} Tokens included</small>
          </td>
          <td>998431</td>
          <td>1</td>
          <td>₹${amount.toFixed(2)}</td>
          <td>₹${amount.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <table>
        <tr>
          <td>Subtotal</td>
          <td style="text-align: right;">₹${amount.toFixed(2)}</td>
        </tr>
        ${isIntraState ? `
        <tr>
          <td>CGST (9%)</td>
          <td style="text-align: right;">₹${cgstAmount.toFixed(2)}</td>
        </tr>
        <tr>
          <td>SGST (9%)</td>
          <td style="text-align: right;">₹${sgstAmount.toFixed(2)}</td>
        </tr>
        ` : `
        <tr>
          <td>IGST (18%)</td>
          <td style="text-align: right;">₹${igstAmount.toFixed(2)}</td>
        </tr>
        `}
        <tr>
          <td>Total</td>
          <td style="text-align: right;">₹${total_amount.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <div class="terms">
      <h4>Terms & Conditions</h4>
      <p>1. Tokens are non-refundable and non-transferable.</p>
      <p>2. This is a computer-generated invoice and does not require a signature.</p>
      <p>3. For any queries, please contact support@hippi.app</p>
    </div>

    <div class="footer">
      <p>Thank you for your business!</p>
      <p>Hippi Technology Pvt. Ltd. | support@hippi.app | www.hippi.app</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate HTML for escrow deposit invoice
 */
function generateEscrowDepositInvoiceHTML(data: {
  invoice_number: string;
  invoice_date: string;
  brand: BrandInfo;
  amount: number;
  gst_amount: number;
  total_amount: number;
  transaction_id: string;
  campaign_name?: string;
}): string {
  const {
    invoice_number,
    invoice_date,
    brand,
    amount,
    gst_amount,
    total_amount,
    transaction_id,
    campaign_name,
  } = data;

  const isIntraState = brand.state_code === '27'; // Maharashtra state code
  const cgstAmount = isIntraState ? gst_amount / 2 : 0;
  const sgstAmount = isIntraState ? gst_amount / 2 : 0;
  const igstAmount = isIntraState ? 0 : gst_amount;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Helvetica', 'Arial', sans-serif;
      font-size: 12px;
      color: #333;
      line-height: 1.4;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 30px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      border-bottom: 2px solid #4f46e5;
      padding-bottom: 20px;
    }
    .company-info h1 {
      font-size: 28px;
      color: #4f46e5;
      margin-bottom: 5px;
    }
    .company-info p {
      font-size: 11px;
      color: #666;
    }
    .invoice-title {
      text-align: right;
    }
    .invoice-title h2 {
      font-size: 24px;
      color: #333;
      margin-bottom: 10px;
    }
    .invoice-title p {
      font-size: 11px;
      color: #666;
    }
    .invoice-details {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .bill-to, .invoice-info {
      width: 48%;
    }
    .bill-to h3, .invoice-info h3 {
      font-size: 14px;
      color: #4f46e5;
      margin-bottom: 10px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 5px;
    }
    .bill-to p, .invoice-info p {
      margin-bottom: 3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background-color: #4f46e5;
      color: white;
      padding: 12px 10px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
    }
    td {
      padding: 12px 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:nth-child(even) {
      background-color: #f9fafb;
    }
    .totals {
      width: 300px;
      margin-left: auto;
    }
    .totals table {
      margin-bottom: 0;
    }
    .totals td {
      padding: 8px 10px;
    }
    .totals tr:last-child td {
      font-weight: bold;
      font-size: 14px;
      background-color: #4f46e5;
      color: white;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 10px;
      color: #666;
    }
    .terms {
      margin-top: 30px;
      padding: 15px;
      background-color: #f9fafb;
      border-radius: 5px;
    }
    .terms h4 {
      font-size: 12px;
      margin-bottom: 8px;
      color: #333;
    }
    .terms p {
      font-size: 10px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="company-info">
        <h1>Hippi</h1>
        <p>Hippi Technology Pvt. Ltd.</p>
        <p>Mumbai, Maharashtra - 400001</p>
        <p>GSTIN: 27AABCH1234D1Z5</p>
      </div>
      <div class="invoice-title">
        <h2>TAX INVOICE</h2>
        <p>Invoice #: ${invoice_number}</p>
        <p>Date: ${invoice_date}</p>
      </div>
    </div>

    <div class="invoice-details">
      <div class="bill-to">
        <h3>Bill To</h3>
        <p><strong>${brand.name}</strong></p>
        ${brand.address ? `<p>${brand.address}</p>` : ''}
        ${brand.gst_number ? `<p>GSTIN: ${brand.gst_number}</p>` : ''}
        ${brand.pan ? `<p>PAN: ${brand.pan}</p>` : ''}
        ${brand.state ? `<p>State: ${brand.state}</p>` : ''}
      </div>
      <div class="invoice-info">
        <h3>Transaction Details</h3>
        <p><strong>Transaction ID:</strong> ${transaction_id}</p>
        <p><strong>Payment Method:</strong> Online (Razorpay)</p>
        <p><strong>Status:</strong> Paid</p>
        ${campaign_name ? `<p><strong>Campaign:</strong> ${campaign_name}</p>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>HSN/SAC</th>
          <th>Qty</th>
          <th>Rate</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>Escrow Deposit</strong><br>
            <small>Campaign Escrow Funds</small>
            ${campaign_name ? `<br><small>For: ${campaign_name}</small>` : ''}
          </td>
          <td>998431</td>
          <td>1</td>
          <td>₹${amount.toFixed(2)}</td>
          <td>₹${amount.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <table>
        <tr>
          <td>Subtotal</td>
          <td style="text-align: right;">₹${amount.toFixed(2)}</td>
        </tr>
        ${isIntraState ? `
        <tr>
          <td>CGST (9%)</td>
          <td style="text-align: right;">₹${cgstAmount.toFixed(2)}</td>
        </tr>
        <tr>
          <td>SGST (9%)</td>
          <td style="text-align: right;">₹${sgstAmount.toFixed(2)}</td>
        </tr>
        ` : `
        <tr>
          <td>IGST (18%)</td>
          <td style="text-align: right;">₹${igstAmount.toFixed(2)}</td>
        </tr>
        `}
        <tr>
          <td>Total</td>
          <td style="text-align: right;">₹${total_amount.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <div class="terms">
      <h4>Terms & Conditions</h4>
      <p>1. Escrow funds are held securely and released to creators upon campaign completion.</p>
      <p>2. This is a computer-generated invoice and does not require a signature.</p>
      <p>3. For any queries, please contact support@hippi.app</p>
    </div>

    <div class="footer">
      <p>Thank you for your business!</p>
      <p>Hippi Technology Pvt. Ltd. | support@hippi.app | www.hippi.app</p>
    </div>
  </div>
</body>
</html>
  `;
}

// ============ PDF GENERATION USING PDFKIT ============

interface InvoicePDFData {
  invoice_number: string;
  invoice_date: string;
  brand: BrandInfo;
  description: string;
  sub_description: string;
  amount: number;
  gst_amount: number;
  total_amount: number;
  transaction_id: string;
  hsn_sac: string;
}

/**
 * Generate PDF invoice using PDFKit
 */
async function generateInvoicePDF(data: InvoicePDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const {
        invoice_number,
        invoice_date,
        brand,
        description,
        sub_description,
        amount,
        gst_amount,
        total_amount,
        transaction_id,
        hsn_sac,
      } = data;

      const isIntraState = brand.state_code === '27'; // Maharashtra state code
      const cgstAmount = isIntraState ? gst_amount / 2 : 0;
      const sgstAmount = isIntraState ? gst_amount / 2 : 0;
      const igstAmount = isIntraState ? 0 : gst_amount;

      // Colors
      const primaryColor = '#4f46e5';
      const textColor = '#333333';
      const lightGray = '#666666';

      // ============ HEADER ============
      doc.fillColor(primaryColor)
        .fontSize(28)
        .text('Hippi', 50, 50);
      
      doc.fillColor(lightGray)
        .fontSize(10)
        .text('Hippi Technology Pvt. Ltd.', 50, 85)
        .text('Mumbai, Maharashtra - 400001', 50, 98)
        .text('GSTIN: 27AABCH1234D1Z5', 50, 111);

      // Invoice title on right
      doc.fillColor(textColor)
        .fontSize(20)
        .text('TAX INVOICE', 400, 50, { align: 'right' });
      
      doc.fillColor(lightGray)
        .fontSize(10)
        .text(`Invoice #: ${invoice_number}`, 400, 80, { align: 'right' })
        .text(`Date: ${invoice_date}`, 400, 93, { align: 'right' });

      // Line under header
      doc.moveTo(50, 140)
        .lineTo(545, 140)
        .strokeColor(primaryColor)
        .lineWidth(2)
        .stroke();

      // ============ BILL TO & TRANSACTION DETAILS ============
      let yPos = 160;

      // Bill To
      doc.fillColor(primaryColor)
        .fontSize(12)
        .text('Bill To', 50, yPos);
      
      yPos += 20;
      doc.fillColor(textColor)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(brand.name, 50, yPos);
      
      yPos += 15;
      doc.font('Helvetica')
        .fontSize(10)
        .fillColor(lightGray);
      
      if (brand.address) {
        doc.text(brand.address, 50, yPos);
        yPos += 13;
      }
      if (brand.gst_number) {
        doc.text(`GSTIN: ${brand.gst_number}`, 50, yPos);
        yPos += 13;
      }
      if (brand.pan) {
        doc.text(`PAN: ${brand.pan}`, 50, yPos);
        yPos += 13;
      }
      if (brand.state) {
        doc.text(`State: ${brand.state}`, 50, yPos);
      }

      // Transaction Details on right
      doc.fillColor(primaryColor)
        .fontSize(12)
        .text('Transaction Details', 350, 160);
      
      doc.fillColor(lightGray)
        .fontSize(10)
        .text(`Transaction ID: ${transaction_id}`, 350, 180)
        .text('Payment Method: Online (Razorpay)', 350, 193)
        .text('Status: Paid', 350, 206);

      // ============ TABLE HEADER ============
      yPos = 280;
      
      // Table header background
      doc.rect(50, yPos, 495, 25)
        .fill(primaryColor);
      
      doc.fillColor('white')
        .fontSize(9)
        .text('DESCRIPTION', 55, yPos + 8)
        .text('HSN/SAC', 250, yPos + 8)
        .text('QTY', 320, yPos + 8)
        .text('RATE', 370, yPos + 8)
        .text('AMOUNT', 450, yPos + 8);

      // ============ TABLE ROW ============
      yPos += 25;
      
      doc.rect(50, yPos, 495, 50)
        .fill('#f9fafb');
      
      doc.fillColor(textColor)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(description, 55, yPos + 8);
      
      doc.font('Helvetica')
        .fontSize(9)
        .fillColor(lightGray)
        .text(sub_description, 55, yPos + 22);

      doc.fillColor(textColor)
        .fontSize(10)
        .text(hsn_sac, 250, yPos + 15)
        .text('1', 320, yPos + 15)
        .text(`₹${amount.toFixed(2)}`, 370, yPos + 15)
        .text(`₹${amount.toFixed(2)}`, 450, yPos + 15);

      // ============ TOTALS ============
      yPos += 70;
      const totalsX = 350;
      
      // Subtotal
      doc.fillColor(textColor)
        .fontSize(10)
        .text('Subtotal', totalsX, yPos)
        .text(`₹${amount.toFixed(2)}`, 480, yPos, { align: 'right' });
      
      yPos += 18;
      
      // GST breakdown
      if (isIntraState) {
        doc.text('CGST (9%)', totalsX, yPos)
          .text(`₹${cgstAmount.toFixed(2)}`, 480, yPos, { align: 'right' });
        yPos += 18;
        doc.text('SGST (9%)', totalsX, yPos)
          .text(`₹${sgstAmount.toFixed(2)}`, 480, yPos, { align: 'right' });
      } else {
        doc.text('IGST (18%)', totalsX, yPos)
          .text(`₹${igstAmount.toFixed(2)}`, 480, yPos, { align: 'right' });
      }
      
      yPos += 25;
      
      // Total with background
      doc.rect(totalsX - 5, yPos - 5, 200, 25)
        .fill(primaryColor);
      
      doc.fillColor('white')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Total', totalsX, yPos)
        .text(`₹${total_amount.toFixed(2)}`, 480, yPos, { align: 'right' });

      // ============ TERMS & CONDITIONS ============
      yPos += 50;
      
      doc.rect(50, yPos, 495, 70)
        .fill('#f9fafb');
      
      doc.fillColor(textColor)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Terms & Conditions', 60, yPos + 10);
      
      doc.font('Helvetica')
        .fontSize(9)
        .fillColor(lightGray)
        .text('1. Tokens/Escrow funds are non-refundable and non-transferable.', 60, yPos + 28)
        .text('2. This is a computer-generated invoice and does not require a signature.', 60, yPos + 41)
        .text('3. For any queries, please contact support@hippi.app', 60, yPos + 54);

      // ============ FOOTER ============
      yPos += 100;
      
      doc.moveTo(50, yPos)
        .lineTo(545, yPos)
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .stroke();
      
      doc.fillColor(lightGray)
        .fontSize(9)
        .text('Thank you for your business!', 50, yPos + 15, { align: 'center', width: 495 })
        .text('Hippi Technology Pvt. Ltd. | support@hippi.app | www.hippi.app', 50, yPos + 30, { align: 'center', width: 495 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// ============ GCS UPLOAD ============

/**
 * Upload PDF to GCS and return signed URL
 */
async function uploadPDFToGCS(
  pdfBuffer: Buffer,
  invoiceNumber: string,
  brandId: string
): Promise<string> {
  const filename = `${INVOICE_FOLDER}/${brandId}/${invoiceNumber}.pdf`;
  const file = bucket.file(filename);

  await file.save(pdfBuffer, {
    metadata: {
      contentType: 'application/pdf',
      metadata: {
        invoiceNumber,
        brandId,
        generatedAt: new Date().toISOString(),
      },
    },
  });

  // Generate signed URL valid for 10 years (essentially permanent for practical purposes)
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000, // 10 years
  });

  return signedUrl;
}

// ============ MAIN INVOICE GENERATION FUNCTIONS ============

/**
 * Generate invoice for brand token/subscription purchase
 * Only call this for successful (completed) transactions
 */
export async function generateBrandPurchaseInvoice(
  input: GenerateBrandPurchaseInvoiceInput
): Promise<InvoiceResult> {
  const { transaction_id, brand_id, amount, brand, package_name, tokens, package_type } = input;

  logger.info('[Invoice] Generating brand purchase invoice', { transaction_id, brand_id });

  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber();
  const invoiceDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Calculate GST (assuming amount is inclusive of GST at 18%)
  const baseAmount = amount / 1.18;
  const gstAmount = amount - baseAmount;

  // Generate PDF using PDFKit
  const pdfBuffer = await generateInvoicePDF({
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    brand,
    description: package_name,
    sub_description: `${package_type === 'subscription' ? 'Subscription Package' : 'Token Top-up Package'} - ${tokens} Tokens included`,
    amount: baseAmount,
    gst_amount: gstAmount,
    total_amount: amount,
    transaction_id,
    hsn_sac: '998431',
  });

  // Upload to GCS
  const pdfUrl = await uploadPDFToGCS(pdfBuffer, invoiceNumber, brand_id);

  // Update transaction with invoice details
  await db('brand_transactions')
    .where('id', transaction_id)
    .update({
      invoice_number: invoiceNumber,
      invoice_pdf_url: pdfUrl,
      updated_at: new Date(),
    });

  logger.info('[Invoice] Brand purchase invoice generated and saved', {
    transaction_id,
    invoice_number: invoiceNumber,
    pdf_url: pdfUrl,
  });

  return {
    invoice_number: invoiceNumber,
    invoice_pdf_url: pdfUrl,
  };
}

/**
 * Generate invoice for escrow deposit
 * Only call this for successful (completed) transactions
 */
export async function generateEscrowDepositInvoice(
  input: GenerateEscrowDepositInvoiceInput
): Promise<InvoiceResult> {
  const { transaction_id, brand_id, amount, brand, campaign_name } = input;

  logger.info('[Invoice] Generating escrow deposit invoice', { transaction_id, brand_id });

  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber();
  const invoiceDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Calculate GST (assuming amount is inclusive of GST at 18%)
  const baseAmount = amount / 1.18;
  const gstAmount = amount - baseAmount;

  // Generate PDF using PDFKit
  const pdfBuffer = await generateInvoicePDF({
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    brand,
    description: 'Escrow Deposit',
    sub_description: campaign_name ? `Campaign Escrow Funds - For: ${campaign_name}` : 'Campaign Escrow Funds',
    amount: baseAmount,
    gst_amount: gstAmount,
    total_amount: amount,
    transaction_id,
    hsn_sac: '998431',
  });

  // Upload to GCS
  const pdfUrl = await uploadPDFToGCS(pdfBuffer, invoiceNumber, brand_id);

  // Update transaction with invoice details
  await db('brand_transactions')
    .where('id', transaction_id)
    .update({
      invoice_number: invoiceNumber,
      invoice_pdf_url: pdfUrl,
      updated_at: new Date(),
    });

  logger.info('[Invoice] Escrow deposit invoice generated and saved', {
    transaction_id,
    invoice_number: invoiceNumber,
    pdf_url: pdfUrl,
  });

  return {
    invoice_number: invoiceNumber,
    invoice_pdf_url: pdfUrl,
  };
}

/**
 * Get invoice details for a transaction
 */
export async function getInvoiceByTransactionId(
  transactionId: string
): Promise<{ invoice_number: string; invoice_pdf_url: string } | null> {
  const transaction = await db('brand_transactions')
    .where('id', transactionId)
    .select('invoice_number', 'invoice_pdf_url')
    .first();

  if (!transaction || !transaction.invoice_number) {
    return null;
  }

  return {
    invoice_number: transaction.invoice_number,
    invoice_pdf_url: transaction.invoice_pdf_url,
  };
}

/**
 * Regenerate invoice for a transaction (admin function)
 */
export async function regenerateInvoice(
  transactionId: string
): Promise<InvoiceResult | null> {
  const transaction = await db('brand_transactions')
    .where('id', transactionId)
    .where('status', 'completed')
    .first();

  if (!transaction) {
    throw new Error('Transaction not found or not completed');
  }

  const brand = await db('brands').where('id', transaction.brand_id).first();

  let metadata: any = {};
  try {
    metadata = typeof transaction.metadata === 'string'
      ? JSON.parse(transaction.metadata)
      : transaction.metadata || {};
  } catch {
    metadata = {};
  }

  if (transaction.transaction_type === 'token_credit') {
    return generateBrandPurchaseInvoice({
      transaction_id: transactionId,
      brand_id: transaction.brand_id,
      amount: parseFloat(transaction.amount),
      brand: {
        name: brand?.name || brand?.company_name || 'Brand',
        address: brand?.address,
        pan: brand?.pan_number,
        gst_number: brand?.gst_number,
        state: brand?.state,
        state_code: brand?.state_code,
      },
      package_name: metadata.package_display_name || metadata.package_name || 'Package',
      tokens: parseInt(metadata.tokens_included, 10) || 0,
      package_type: metadata.package_type,
    });
  } else if (transaction.transaction_type === 'escrow_deposit') {
    let campaignName: string | undefined;
    if (transaction.reference_id) {
      const campaign = await db('campaigns').where('id', transaction.reference_id).first();
      campaignName = campaign?.name;
    }

    return generateEscrowDepositInvoice({
      transaction_id: transactionId,
      brand_id: transaction.brand_id,
      amount: parseFloat(transaction.amount),
      brand: {
        name: brand?.name || brand?.company_name || 'Brand',
        address: brand?.address,
        pan: brand?.pan_number,
        gst_number: brand?.gst_number,
        state: brand?.state,
        state_code: brand?.state_code,
      },
      campaign_name: campaignName,
    });
  }

  return null;
}
