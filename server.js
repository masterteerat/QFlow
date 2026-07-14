const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = 3000;

// อนุญาตให้รับข้อมูลแบบ JSON จากหน้าเว็บได้
app.use(express.json());

// ตั้งค่าเชื่อมต่อฐานข้อมูล QFlow
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// 1. Route สำหรับรันคำสั่ง SQL (API Endpoint)
app.post('/api/query', async (req, res) => {
  const { sql } = req.body;
  
  if (!sql) {
    return res.status(400).json({ error: "กรุณาใส่คำสั่ง SQL ครับ" });
  }

  try {
    const start = Date.now();
    const result = await pool.query(sql);
    const duration = Date.now() - start;

    // ส่งผลลัพธ์กลับไปให้หน้าเว็บ
    res.json({
      success: true,
      command: result.command, // ประเภทคำสั่ง เช่น SELECT, INSERT
      rowCount: result.rowCount, // จำนวนแถวที่พบหรือถูกแก้
      fields: result.fields ? result.fields.map(f => f.name) : [], // ชื่อคอลัมน์
      rows: result.rows, // ข้อมูลในตาราง
      duration: `${duration} ms` // ใช้เวลารันกี่มิลลิวินาที
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message // ถ้าพิมพ์ SQL ผิด จะส่ง Error ไปโชว์หน้าเว็บ
    });
  }
});

// 2. Route หน้าเว็บแอปพลิเคชัน (HTML + CSS + JavaScript)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <title>QFlow - SQL Web Console</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f4f7f6; color: #333; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; margin-top: 0; display: flex; align-items: center; justify-content: space-between; }
        .badge { background: #e74c3c; color: white; padding: 4px 8px; border-radius: 4px; font-size: 14px; }
        textarea { width: 100%; height: 120px; padding: 12px; border: 2px solid #bdc3c7; border-radius: 6px; font-family: 'Consolas', monospace; font-size: 16px; box-sizing: border-box; resize: vertical; }
        textarea:focus { border-color: #3498db; outline: none; }
        .btn-group { margin: 15px 0; display: flex; gap: 10px; }
        button { background-color: #3498db; color: white; border: none; padding: 10px 20px; font-size: 16px; border-radius: 6px; cursor: pointer; transition: background 0.2s; font-weight: bold; }
        button:hover { background-color: #2980b9; }
        button.clear { background-color: #95a5a6; }
        button.clear:hover { background-color: #7f8c8d; }
        #status { margin-bottom: 15px; font-weight: bold; }
        .error { color: #c0392b; background: #fadbd8; padding: 10px; border-radius: 4px; border-left: 5px solid #e74c3c; }
        .success { color: #27ae60; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
        th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
        th { background-color: #f8f9f9; color: #2c3e50; font-weight: bold; }
        tr:nth-child(even) { background-color: #fcfcfc; }
        tr:hover { background-color: #f1f4f7; }
        .quick-queries { margin-bottom: 15px; }
        .quick-queries button { background: #ecf0f1; color: #2c3e50; font-size: 13px; padding: 6px 12px; font-weight: normal; }
        .quick-queries button:hover { background: #d5dbdb; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🐘 QFlow SQL Console <span class="badge">Live Database</span></h1>
        
        <div class="quick-queries">
          <strong>คำสั่งด่วน: </strong>
          <button onclick="setQuery('SELECT * FROM Customer;')">ดูลูกค้าทั้งหมด</button>
          <button onclick="setQuery('SELECT * FROM Business;')">ดูร้านค้า</button>
          <button onclick="setQuery('SELECT t.ticket_id, c.fname, b.business_name, s.status_name FROM Ticket t JOIN Customer c ON t.customer_id = c.customer_id JOIN Time_Slot ts ON t.timeslot_id = ts.timeslot_id JOIN Business b ON ts.business_id = b.business_id JOIN Ticket_Status s ON t.status_id = s.status_id;')">ดูตั๋วคิวพร้อมชื่อร้าน</button>
        </div>

        <textarea id="sqlInput" placeholder="พิมพ์คำสั่ง SQL ที่นี่ เช่น SELECT * FROM Ticket;"></textarea>
        
        <div class="btn-group">
          <button onclick="runQuery()">▶ รันคำสั่ง (Run Query)</button>
          <button class="clear" onclick="document.getElementById('sqlInput').value = '';">ล้างข้อความ</button>
        </div>

        <div id="status"></div>
        <div id="resultContainer"></div>
      </div>

      <script>
        function setQuery(sql) {
          document.getElementById('sqlInput').value = sql;
          runQuery();
        }

        async function runQuery() {
          const sql = document.getElementById('sqlInput').value.trim();
          const statusDiv = document.getElementById('status');
          const resultDiv = document.getElementById('resultContainer');
          
          if (!sql) return;

          statusDiv.innerHTML = '<span style="color: #f39c12;">⏳ กำลังรันคำสั่ง...</span>';
          resultDiv.innerHTML = '';

          try {
            const response = await fetch('/api/query', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sql })
            });
            
            const data = await response.json();

            if (data.success) {
              statusDiv.innerHTML = \`<span class="success">✔ สำเร็จ (\${data.command}) - พบข้อมูล \${data.rowCount} แถว (ใช้เวลา \${data.duration})</span>\`;
              
              if (data.rows && data.rows.length > 0) {
                let tableHtml = '<table><thead><tr>';
                data.fields.forEach(field => { tableHtml += \`<th>\${field}</th>\`; });
                tableHtml += '</tr></thead><tbody>';
                
                data.rows.forEach(row => {
                  tableHtml += '<tr>';
                  data.fields.forEach(field => {
                    const val = row[field] === null ? '<em>null</em>' : row[field];
                    tableHtml += \`<td>\${val}</td>\`;
                  });
                  tableHtml += '</tr>';
                });
                tableHtml += '</tbody></table>';
                resultDiv.innerHTML = tableHtml;
              } else {
                resultDiv.innerHTML = '<p style="color: #7f8c8d; font-style: italic;">ไม่พบข้อมูลแสดงผล (หรือเป็นคำสั่ง INSERT / UPDATE / DELETE)</p>';
              }
            } else {
              statusDiv.innerHTML = '';
              resultDiv.innerHTML = \`<div class="error"><strong>❌ เกิดข้อผิดพลาด (SQL Error):</strong><br>\${data.error}</div>\`;
            }
          } catch (err) {
            statusDiv.innerHTML = '';
            resultDiv.innerHTML = \`<div class="error"><strong>❌ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้:</strong><br>\${err.message}</div>\`;
          }
        }
      </script>
    </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`QFlow SQL Web Console running on port ${port}`);
});