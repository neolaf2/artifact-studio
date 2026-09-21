declare module 'html2pdf.js' {
  type Html2PdfWorker = {
    set: (opt: Record<string, unknown>) => Html2PdfWorker;
    from: (el: HTMLElement | string) => Html2PdfWorker;
    save: () => Promise<void>;
  };
  type Html2Pdf = () => Html2PdfWorker;
  const html2pdf: Html2Pdf;
  export default html2pdf;
}
