declare module "mammoth/mammoth.browser.js" {
  function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
}
