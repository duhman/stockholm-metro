const fetchSites = async () => {
  try {
    const res = await fetch("https://transport.integration.sl.se/v1/sites");
    const data = await res.json();
    
    // Test search for Gärdet
    const searchLower = "gärdet";
    const results = data.filter(site => site.name.toLowerCase().includes(searchLower)).slice(0, 10);
    console.log("Search results for Gärdet:", results);
  } catch (e) {
    console.error(e);
  }
};

fetchSites();
