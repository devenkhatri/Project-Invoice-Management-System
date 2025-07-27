interface GSTCalculation {
  cgst: number
  sgst: number
  igst: number
  totalTax: number
  totalAmount: number
  reverseCharge?: boolean
  supplierTax?: number
  recipientTax?: number
  tdsRate?: number
  tdsAmount?: number
  netPayable?: number
}

interface InvoiceData {
  amount: number
  clientState?: string
  businessState?: string
  serviceType?: string
  clientType?: string
  reverseCharge?: boolean
  tdsApplicable?: boolean
}

const GST_RATES = {
  consulting: 18,
  design: 18,
  development: 18,
  legal_services: 18,
  default: 18
}

const TDS_RATES = {
  consulting: 10,
  legal_services: 10,
  technical_services: 2,
  default: 1
}

const REVERSE_CHARGE_SERVICES = [
  'legal_services',
  'ca_services',
  'technical_services'
]

export function calculateGST(invoiceData: InvoiceData): GSTCalculation {
  const { amount, clientState, businessState, serviceType = 'default', clientType, reverseCharge, tdsApplicable } = invoiceData
  
  const gstRate = GST_RATES[serviceType as keyof typeof GST_RATES] || GST_RATES.default
  const totalTax = (amount * gstRate) / 100
  
  let cgst = 0
  let sgst = 0
  let igst = 0
  
  // Determine tax structure based on state
  if (clientState && businessState) {
    if (clientState === businessState) {
      // Intra-state: CGST + SGST
      cgst = totalTax / 2
      sgst = totalTax / 2
    } else {
      // Inter-state: IGST
      igst = totalTax
    }
  } else {
    // Default to IGST if states not specified
    igst = totalTax
  }
  
  const result: GSTCalculation = {
    cgst,
    sgst,
    igst,
    totalTax,
    totalAmount: amount + totalTax
  }
  
  // Handle reverse charge
  if (reverseCharge || (serviceType && REVERSE_CHARGE_SERVICES.includes(serviceType))) {
    result.reverseCharge = true
    result.supplierTax = 0
    result.recipientTax = totalTax
  }
  
  // Handle TDS
  if (tdsApplicable && clientType === 'government') {
    const tdsRate = TDS_RATES[serviceType as keyof typeof TDS_RATES] || TDS_RATES.default
    const tdsAmount = (amount * tdsRate) / 100
    
    result.tdsRate = tdsRate
    result.tdsAmount = tdsAmount
    result.netPayable = result.totalAmount - tdsAmount
  }
  
  return result
}

export function validateGSTIN(gstin: string): boolean {
  if (!gstin || gstin.length !== 15) {
    return false
  }
  
  // GSTIN format: 2 digits (state) + 10 alphanumeric (PAN) + 1 digit (entity) + 1 alphanumeric (check digit) + 1 alphanumeric (default 'Z')
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/
  
  if (!gstinRegex.test(gstin)) {
    return false
  }
  
  // Validate check digit (simplified version)
  return validateGSTINCheckDigit(gstin)
}

function validateGSTINCheckDigit(gstin: string): boolean {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const weights = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2]
  
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const charIndex = chars.indexOf(gstin[i])
    const product = charIndex * weights[i]
    sum += Math.floor(product / 36) + (product % 36)
  }
  
  const checkDigitIndex = (36 - (sum % 36)) % 36
  const expectedCheckDigit = chars[checkDigitIndex]
  
  return gstin[13] === expectedCheckDigit
}

export function generateGSTReport(reportType: string, data: any[], period: string): any {
  switch (reportType) {
    case 'GSTR1':
      return generateGSTR1Report(data, period)
    case 'GSTR3B':
      return generateGSTR3BReport(data, period)
    default:
      throw new Error(`Unsupported report type: ${reportType}`)
  }
}

function generateGSTR1Report(invoices: any[], period: string): any {
  const b2bSupplies = invoices
    .filter(inv => inv.clientGSTIN)
    .map(inv => ({
      ctin: inv.clientGSTIN,
      inv: [{
        inum: inv.invoiceNumber,
        idt: inv.invoiceDate,
        val: inv.amount + inv.gstAmount,
        pos: getStateCode(inv.placeOfSupply),
        rchrg: inv.reverseCharge ? 'Y' : 'N',
        itms: [{
          num: 1,
          itm_det: {
            txval: inv.amount,
            rt: 18,
            iamt: inv.placeOfSupply !== 'Maharashtra' ? inv.gstAmount : 0,
            camt: inv.placeOfSupply === 'Maharashtra' ? inv.gstAmount / 2 : 0,
            samt: inv.placeOfSupply === 'Maharashtra' ? inv.gstAmount / 2 : 0
          }
        }]
      }]
    }))
  
  const hsnSummary = generateHSNSummary(invoices)
  
  return {
    gstin: '27ABCDE1234F1Z5', // Business GSTIN
    ret_period: period,
    b2b: b2bSupplies,
    b2cl: [], // B2C large supplies
    b2cs: [], // B2C small supplies
    hsn: hsnSummary
  }
}

function generateGSTR3BReport(transactions: any[], period: string): any {
  const outwardSupplies = transactions.filter(t => t.type === 'outward')
  const inwardSupplies = transactions.filter(t => t.type === 'inward')
  
  const totalOutwardValue = outwardSupplies.reduce((sum, t) => sum + t.amount, 0)
  const totalOutwardTax = outwardSupplies.reduce((sum, t) => sum + t.gstAmount, 0)
  
  const totalInwardValue = inwardSupplies.reduce((sum, t) => sum + t.amount, 0)
  const totalInwardTax = inwardSupplies.reduce((sum, t) => sum + t.gstAmount, 0)
  
  return {
    gstin: '27ABCDE1234F1Z5',
    ret_period: period,
    outward_supplies: {
      total_taxable_value: totalOutwardValue,
      total_tax_amount: totalOutwardTax
    },
    inward_supplies: {
      total_taxable_value: totalInwardValue,
      total_tax_amount: totalInwardTax
    },
    itc_details: {
      itc_availed: totalInwardTax,
      itc_reversed: 0
    },
    tax_liability: {
      integrated_tax: 0,
      central_tax: totalOutwardTax / 2,
      state_tax: totalOutwardTax / 2,
      cess: 0
    }
  }
}

function generateHSNSummary(invoices: any[]): any[] {
  const hsnMap = new Map()
  
  invoices.forEach(inv => {
    inv.lineItems?.forEach((item: any) => {
      const hsnCode = item.hsnCode || item.sacCode || '998314'
      if (!hsnMap.has(hsnCode)) {
        hsnMap.set(hsnCode, {
          num: 1,
          hsn_sc: hsnCode,
          desc: item.description,
          uqc: 'OTH',
          qty: 0,
          val: 0,
          txval: 0,
          iamt: 0,
          camt: 0,
          samt: 0,
          csamt: 0
        })
      }
      
      const hsnEntry = hsnMap.get(hsnCode)
      hsnEntry.qty += item.quantity || 1
      hsnEntry.val += item.amount
      hsnEntry.txval += item.amount
    })
  })
  
  return Array.from(hsnMap.values())
}

function getStateCode(stateName: string): string {
  const stateCodes: { [key: string]: string } = {
    'Maharashtra': '27',
    'Karnataka': '29',
    'Tamil Nadu': '33',
    'Delhi': '07',
    'Gujarat': '24',
    'Rajasthan': '08',
    'Uttar Pradesh': '09'
  }
  
  return stateCodes[stateName] || '27'
}