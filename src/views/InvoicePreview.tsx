'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Download, Mail, MessageCircle, Loader2 } from 'lucide-react';
import { Document, Page, Text, View, StyleSheet, Image, PDFDownloadLink } from '@react-pdf/renderer';
import { getPayment, getPaymentWhatsAppLink, type Payment } from '../services/payments';
import { getMember, type Member } from '../services/members';
import { auth } from '../services/firebase';

// --- PDF STYLES ---
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  header: { alignItems: 'center', marginBottom: 30 },
  logo: { width: 60, height: 60, marginBottom: 10, borderRadius: 30 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 5, color: '#1F2937' },
  subText: { fontSize: 10, color: '#6B7280', marginBottom: 3, textAlign: 'center' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginVertical: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { flexDirection: 'column' },
  billedTo: { flexDirection: 'row', alignItems: 'center', maxWidth: 300 },
  memberPhoto: { width: 72, height: 72, borderRadius: 36, marginRight: 14, objectFit: 'cover' },
  memberPhotoFallback: { width: 72, height: 72, borderRadius: 36, marginRight: 14, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  memberInitial: { fontSize: 25, fontFamily: 'Helvetica-Bold', color: '#2563EB' },
  label: { fontSize: 9, color: '#9CA3AF', marginBottom: 5, textTransform: 'uppercase', fontFamily: 'Helvetica-Bold' },
  valueMain: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 3, color: '#1F2937' },
  valueSub: { fontSize: 10, color: '#4B5563', marginBottom: 2 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 5, marginBottom: 10, marginTop: 20 },
  tableCol1: { flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1F2937' },
  tableCol2: { width: 100, textAlign: 'right', fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1F2937' },
  tableRow: { flexDirection: 'row', paddingVertical: 10 },
  tableCell1Main: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1F2937' },
  tableCell1Sub: { fontSize: 8, color: '#6B7280', marginTop: 3 },
  tableCell2: { width: 100, textAlign: 'right', fontSize: 10, color: '#1F2937' },
  summaryContainer: { alignItems: 'flex-end', marginTop: 20 },
  summaryBox: { width: 220 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryText: { fontSize: 10, color: '#4B5563' },
  summaryValue: { fontSize: 10, color: '#1F2937' },
  summaryValueBold: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1F2937' },
  summaryValueDanger: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#DC2626' },
  summaryDivider: { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginVertical: 8 },
  footer: { position: 'absolute', bottom: 40, left: 40, right: 40, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 15, alignItems: 'center' },
  footerText: { fontSize: 9, color: '#6B7280', marginBottom: 3 }
});

function getProfilePicturePath(member: Member | null): string | null {
  if (member?.profilePicPath) return member.profilePicPath;
  if (!member?.profilePicUrl) return null;

  try {
    const imageUrl = new URL(member.profilePicUrl);
    if (imageUrl.hostname !== 'firebasestorage.googleapis.com') return null;
    const objectMarker = '/o/';
    const objectMarkerIndex = imageUrl.pathname.indexOf(objectMarker);
    if (objectMarkerIndex === -1) return null;
    return decodeURIComponent(imageUrl.pathname.slice(objectMarkerIndex + objectMarker.length));
  } catch {
    return null;
  }
}

async function createPdfCompatibleImage(imagePath: string): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('You must be signed in to prepare the PDF image.');

  const idToken = await currentUser.getIdToken();
  const response = await fetch(`/api/profile-picture?path=${encodeURIComponent(imagePath)}`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!response.ok) throw new Error(`Profile image request failed with status ${response.status}.`);

  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const maxDimension = 600;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('The browser could not prepare the profile image for the PDF.');
  }

  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return canvas.toDataURL('image/jpeg', 0.9);
}

// --- PDF DOCUMENT TEMPLATE ---
const getMembershipFee = (payment: Payment) => payment.membershipFee
  ?? Math.max(0, payment.totalFee - (payment.personalTrainingFee || 0));

const InvoicePDFDocument = ({ payment, member, profileImageSrc }: { payment: Payment, member: Member | null, profileImageSrc: string | null }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      
      <View style={styles.header}>
        <Image src="/logo.png" style={styles.logo} />
        <Text style={styles.title}>MR GYM UNISEX</Text>
        <Text style={styles.subText}>1st floor, AAA Complex, above Reliance Smart point,</Text>
        <Text style={styles.subText}>Vk Puram, Tirupati, Avilali, Andhra Pradesh 517501</Text>
        <Text style={styles.subText}>Phone: +91 76609 99890 | Email: info@mrgymunisex.com</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <View style={styles.billedTo}>
          {profileImageSrc ? (
            <Image src={profileImageSrc} style={styles.memberPhoto} />
          ) : (
            <View style={styles.memberPhotoFallback}>
              <Text style={styles.memberInitial}>{payment.memberName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.col}>
            <Text style={styles.label}>Billed To:</Text>
            <Text style={styles.valueMain}>{payment.memberName}</Text>
            <Text style={styles.valueSub}>Member ID: {payment.membershipId}</Text>
            {member?.mobileNumber && <Text style={styles.valueSub}>Phone: +91 {member.mobileNumber}</Text>}
            {member?.email && <Text style={styles.valueSub}>Email: {member.email}</Text>}
          </View>
        </View>
        <View style={[styles.col, { alignItems: 'flex-end' }]}>
          <Text style={styles.label}>Invoice Details:</Text>
          <Text style={styles.valueMain}>{payment.invoiceNumber}</Text>
          <Text style={styles.valueSub}>Payment Date: {payment.transactionDate}</Text>
          <Text style={styles.valueSub}>Payment Mode: {payment.paymentMode}</Text>
          <Text style={styles.valueSub}>Status: {payment.status}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.tableHeader}>
        <Text style={styles.tableCol1}>Description</Text>
        <Text style={styles.tableCol2}>Total</Text>
      </View>
      
      <View style={styles.tableRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tableCell1Main}>
            Membership Plan: {member?.planType || 'General Membership'}
          </Text>
          {member && (
            <Text style={styles.tableCell1Sub}>
              Valid: {member.startDate} to {member.expiryDate}  |  Shift: {member.accessShift}
            </Text>
          )}
        </View>
        <Text style={styles.tableCell2}>Rs {getMembershipFee(payment)}</Text>
      </View>

      {(payment.personalTrainingFee || 0) > 0 && (
        <View style={styles.tableRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tableCell1Main}>Personal Training: {payment.personalTrainingPlanName || 'Personal Training'}</Text>
            <Text style={styles.tableCell1Sub}>{payment.personalTrainingPlanDuration || 'Optional personal-training service'}</Text>
          </View>
          <Text style={styles.tableCell2}>Rs {payment.personalTrainingFee}</Text>
        </View>
      )}

      <View style={styles.summaryContainer}>
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>Subtotal:</Text>
            <Text style={styles.summaryValue}>Rs {payment.totalFee}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>Discount:</Text>
            <Text style={styles.summaryValue}>Rs {payment.discount}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryText, { fontFamily: 'Helvetica-Bold', fontSize: 12 }]}>Amount Paid:</Text>
            <Text style={styles.summaryValueBold}>Rs {payment.amountPaid}</Text>
          </View>
          {payment.balanceDue > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryText, { fontFamily: 'Helvetica-Bold', color: '#DC2626' }]}>Balance Due:</Text>
              <Text style={styles.summaryValueDanger}>Rs {payment.balanceDue}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Thank you for your business! For inquiries, contact us at info@mrgymunisex.com.</Text>
        <Text style={styles.footerText}>Generated by MR GYM Administration Portal</Text>
      </View>
    </Page>
  </Document>
);

// --- MAIN REACT COMPONENT ---
export const InvoicePreview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [member, setMember] = useState<Member | null>(null); 
  const [pdfProfileImage, setPdfProfileImage] = useState<{
    sourcePath: string;
    dataUrl: string | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (id) {
      getPayment(id).then(async (paymentData) => {
        setPayment(paymentData);
        if (paymentData && paymentData.memberId) {
          const memberData = await getMember(paymentData.memberId);
          if (memberData) setMember(memberData);
        }
      });
    }
  }, [id]);

  useEffect(() => {
    const sourcePath = getProfilePicturePath(member);
    if (!sourcePath) {
      setPdfProfileImage(null);
      return;
    }

    let cancelled = false;
    createPdfCompatibleImage(sourcePath)
      .then((dataUrl) => {
        if (!cancelled) setPdfProfileImage({ sourcePath, dataUrl, error: null });
      })
      .catch((error: unknown) => {
        console.error('Unable to prepare the profile image for the PDF:', error);
        if (!cancelled) {
          setPdfProfileImage({
            sourcePath,
            dataUrl: null,
            error: 'The profile photo could not be embedded in the PDF.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [member]);

  if (!payment) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" /></div>;

  // Generate safe dynamic filename
  const safeName = payment.memberName.replace(/[^a-zA-Z0-9]/g, '_');
  const dynamicFileName = `MR_GYM_Invoice_${payment.invoiceNumber}_${safeName}.pdf`;
  const profilePicturePath = getProfilePicturePath(member);
  const profileImageSrc = pdfProfileImage && pdfProfileImage.sourcePath === profilePicturePath
    ? pdfProfileImage.dataUrl
    : null;
  const isPreparingProfileImage = Boolean(
    profilePicturePath && pdfProfileImage?.sourcePath !== profilePicturePath,
  );

  return (
    <div className="max-w-5xl mx-auto pb-24 sm:pb-8 relative">
      
      {/* PERFECT PRINT CSS FOR BROWSER PRINTING */}
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            #invoice-print-area, #invoice-print-area * { visibility: visible; }
            #invoice-print-area {
              position: absolute; left: 0; top: 0; width: 100%;
              margin: 0; padding: 20px; box-shadow: none; border: none;
            }
            .no-print { display: none !important; }
          }
        `}
      </style>

      {/* Top Header */}
      <div className="flex justify-between items-center mb-6 no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-[#6B7280]" /></button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937]">Invoice Preview</h1>
            <p className="text-sm text-[#6B7280]">Manage membership payment records</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        
        {/* WEB PREVIEW: Invoice A4 Document */}
        <div id="invoice-print-area" className="flex-1 bg-white p-8 sm:p-12 rounded-none sm:rounded-xl border border-[#E5E7EB] shadow-sm">
          
          <div className="flex flex-col items-center mb-10 text-center">
            <img src="/logo.png" alt="MR GYM" className="h-20 w-20 rounded-full mb-3 shadow-sm border border-gray-100" />
            <h2 className="text-2xl font-bold text-[#1F2937] tracking-wider">MR GYM UNISEX</h2>
            <p className="text-sm text-[#6B7280] mt-1 max-w-md">1st floor, AAA Complex, above Reliance Smart point, Vk Puram, Tirupati, Avilali, Andhra Pradesh 517501</p>
            <p className="text-sm text-[#6B7280] mt-1">Phone: +91 76609 99890 | Email: info@mrgymunisex.com</p>
          </div>

          <div className="flex justify-between mb-10 border-t border-b border-[#E5E7EB] py-6">
            <div className="flex items-center gap-4 min-w-0">
              {member?.profilePicUrl ? (
                <img
                  src={member.profilePicUrl}
                  alt={`${payment.memberName} profile`}
                  className="h-20 w-20 shrink-0 rounded-full border-2 border-white object-cover shadow-md ring-1 ring-[#E5E7EB]"
                />
              ) : (
                <div className="h-20 w-20 shrink-0 rounded-full bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center text-2xl font-bold ring-1 ring-[#BFDBFE]">
                  {payment.memberName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-[#9CA3AF] tracking-wider uppercase mb-2">Billed To:</h3>
                <p className="font-bold text-[#1F2937] text-lg">{payment.memberName}</p>
                <p className="text-sm text-[#4B5563]">Member ID: {payment.membershipId}</p>
                {member?.mobileNumber && <p className="text-sm text-[#4B5563]">Phone: +91 {member.mobileNumber}</p>}
                {member?.email && <p className="text-sm text-[#4B5563] break-all">Email: {member.email}</p>}
              </div>
            </div>
            <div className="text-right">
              <h3 className="text-xs font-bold text-[#9CA3AF] tracking-wider uppercase mb-2">Invoice Details:</h3>
              <p className="font-bold text-[#1F2937] text-lg">{payment.invoiceNumber}</p>
              <p className="text-sm text-[#4B5563]">Payment Date: {payment.transactionDate}</p>
              <p className="text-sm text-[#4B5563]">Payment Mode: {payment.paymentMode}</p>
              <p className="text-sm text-[#4B5563]">Status: <span className="font-semibold text-[#1F2937]">{payment.status}</span></p>
            </div>
          </div>

          <table className="w-full text-left text-sm mb-10">
            <thead className="bg-[#F9FAFB] border-y border-[#E5E7EB]">
              <tr>
                <th className="py-3 px-4 font-semibold text-[#1F2937]">Description</th>
                <th className="py-3 px-4 font-semibold text-[#1F2937] text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              <tr>
                <td className="py-4 px-4">
                  <p className="font-semibold text-[#1F2937]">
                    Membership Plan: {member?.planType || 'General Membership'}
                  </p>
                  {member && (
                    <p className="text-xs text-[#6B7280] mt-1">
                      Valid: <span className="font-medium">{member.startDate}</span> to <span className="font-medium">{member.expiryDate}</span> | Shift: <span className="font-medium">{member.accessShift}</span>
                    </p>
                  )}
                </td>
                <td className="py-4 px-4 text-right text-[#1F2937] font-medium align-top">₹{getMembershipFee(payment)}</td>
              </tr>
              {(payment.personalTrainingFee || 0) > 0 && (
                <tr>
                  <td className="py-4 px-4">
                    <p className="font-semibold text-cyan-800">Personal Training: {payment.personalTrainingPlanName || 'Personal Training'}</p>
                    <p className="text-xs text-[#6B7280] mt-1">{payment.personalTrainingPlanDuration || 'Optional personal-training service'}</p>
                  </td>
                  <td className="py-4 px-4 text-right text-cyan-800 font-medium align-top">₹{payment.personalTrainingFee}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex justify-end mb-16">
            <div className="w-64 space-y-3 text-sm">
              <div className="flex justify-between text-[#4B5563]"><span>Subtotal:</span><span>₹{payment.totalFee}</span></div>
              <div className="flex justify-between text-[#4B5563]"><span>Discount:</span><span>₹{payment.discount}</span></div>
              <div className="flex justify-between font-bold text-lg text-[#1F2937] border-t border-[#E5E7EB] pt-3 mt-3"><span>Amount Paid:</span><span className="text-[#16A34A]">₹{payment.amountPaid}</span></div>
              {payment.balanceDue > 0 && <div className="flex justify-between font-bold text-[#DC2626]"><span>Balance Due:</span><span>₹{payment.balanceDue}</span></div>}
            </div>
          </div>

          <div className="text-center text-xs text-[#6B7280] border-t border-[#E5E7EB] pt-6">
            <p>Thank you for your business! For inquiries, contact us at info@mrgymunisex.com.</p>
            <p className="mt-1">Generated by MR GYM Administration Portal</p>
          </div>
        </div>

        {/* Action Sidebar (Hidden when printing) */}
        <div className="w-full md:w-64 space-y-3 no-print">
          <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col gap-3">
            
            {/* REACT-PDF AUTOMATIC DOWNLOAD LINK */}
            {isPreparingProfileImage ? (
              <div className="w-full h-11 bg-[#93C5FD] text-white rounded-lg flex items-center justify-center gap-2 font-medium cursor-wait">
                <Loader2 className="h-4 w-4 animate-spin"/> Preparing Photo...
              </div>
            ) : (
              <PDFDownloadLink 
                document={<InvoicePDFDocument payment={payment} member={member} profileImageSrc={profileImageSrc} />} 
                fileName={dynamicFileName}
                className="w-full h-11 bg-[#2563EB] text-white rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-[#1D4ED8] transition-colors"
              >
                {({ loading }) => loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin"/> Generating...</>
                ) : (
                  <><Download className="h-4 w-4"/> Download PDF</>
                )}
              </PDFDownloadLink>
            )}

            {pdfProfileImage?.error && (
              <p className="text-xs leading-5 text-[#DC2626]">{pdfProfileImage.error}</p>
            )}

            {/* BROWSER PRINT */}
            <button onClick={() => window.print()} className="w-full h-11 bg-white border border-[#E5E7EB] text-[#4B5563] rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-gray-50 transition-colors">
              <Printer className="h-4 w-4"/> Print Invoice
            </button>

            {/* EMAIL */}
            <button onClick={() => window.location.href = `mailto:${member?.email}?subject=Invoice%20from%20MR%20GYM`} disabled={!member?.email} className="w-full h-11 bg-white border border-[#E5E7EB] text-[#4B5563] rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <Mail className="h-4 w-4"/> {member?.email ? 'Send Email' : 'No Email Added'}
            </button>
            
            {/* DYNAMIC WHATSAPP */}
            <a 
              href={getPaymentWhatsAppLink(payment, member?.mobileNumber || '')} 
              target="_blank" 
              rel="noreferrer" 
              className={`w-full h-11 text-white rounded-lg flex items-center justify-center gap-2 font-medium transition-colors ${member?.mobileNumber ? 'bg-[#25D366] hover:bg-[#20bd5a]' : 'bg-gray-300 cursor-not-allowed'}`}
              onClick={(e) => { if(!member?.mobileNumber) e.preventDefault(); }}
            >
              <MessageCircle className="h-4 w-4"/> WhatsApp
            </a>
          </div>
        </div>

      </div>
    </div>
  );
};
