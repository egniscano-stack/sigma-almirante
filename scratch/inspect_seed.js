import fs from 'fs';

try {
  const seed = JSON.parse(fs.readFileSync('./initial_seed.json', 'utf8'));
  console.log("Keys in seed:", Object.keys(seed));
  
  if (seed.taxpayers) {
    console.log(`Number of taxpayers in seed: ${seed.taxpayers.length}`);
    const commercialTps = seed.taxpayers.filter(t => t.hasCommercialActivity);
    console.log(`Number of commercial taxpayers: ${commercialTps.length}`);
    
    // Look at a few commercial taxpayers
    console.log("\nSample Commercial Taxpayers:");
    commercialTps.slice(0, 3).forEach(t => {
      console.log({
        id: t.id,
        name: t.name,
        commercialName: t.commercialName,
        selectedTaxCodes: t.selectedTaxCodes,
        selectedRates: t.selectedRates,
        magnitude: t.magnitude
      });
    });
  }
  
  if (seed.transactions) {
    console.log(`\nNumber of transactions in seed: ${seed.transactions.length}`);
    
    // Look at a few transactions with different taxTypes
    console.log("\nSample Transactions:");
    const types = [...new Set(seed.transactions.map(tx => tx.taxType))];
    types.forEach(type => {
      const tx = seed.transactions.find(t => t.taxType === type);
      if (tx) {
        console.log({
          id: tx.id,
          taxpayerId: tx.taxpayerId,
          taxType: tx.taxType,
          amount: tx.amount,
          date: tx.date,
          description: tx.description,
          paymentMethod: tx.paymentMethod
        });
      }
    });
  }
} catch (error) {
  console.error("Error inspecting seed:", error);
}
