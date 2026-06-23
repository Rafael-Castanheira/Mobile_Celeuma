const https = require('https');
https.get('https://galeria360-backend.onrender.com/ponto/list', (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        try {
            const parsed = JSON.parse(data);
            const ponto = parsed.pontos.find(p => p.name === 'V4-7' || p.nome === 'V4-7');
            if (ponto) {
                console.log("Found ponto ID:", ponto.id_ponto);
                https.get('https://galeria360-backend.onrender.com/mobile/pontos/' + ponto.id_ponto + '/hotspots?includeAll=true', (res2) => {
                    let data2 = '';
                    res2.on('data', d => data2 += d);
                    res2.on('end', () => {
                        console.log("Mobile Hotspots:");
                        console.log(data2);
                    });
                });
            } else {
                console.log("Ponto V4-7 not found in list.");
                console.log("Total points returned:", parsed.pontos.length);
            }
        } catch(e) { 
            console.error("Error parsing JSON. Raw response:");
            console.log(data.slice(0, 500));
        }
    });
});
