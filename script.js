/**
 * script.js
 * ไฟล์ JavaScript กลางสำหรับใช้งานร่วมกันทุกหน้า (product.html, order.html, admin.html)
 * ตรวจสอบการทำงานอัตโนมัติจาก DOM Element ที่ปรากฏในหน้านั้นๆ
 */

const STORAGE_KEY = 'bodyScentOrders';
const MOODS = ['ทั้งหมด', 'Fresh', 'Sweet', 'Confident', 'Romance'];

document.addEventListener('DOMContentLoaded', () => {
    // 1. ตรวจสอบหน้า product.html
    if (document.getElementById('product-list')) {
        initProductPage();
    }

    // 2. ตรวจสอบหน้า order.html
    if (document.getElementById('orderForm')) {
        initOrderPage();
    }

    // 3. ตรวจสอบหน้า admin.html
    if (document.getElementById('ordersTable')) {
        initAdminPage();
    }
});

/* ==========================================================================
   1. หน้าแสดงสินค้า (product.html)
   ========================================================================== */
async function initProductPage() {
    const productListEl = document.getElementById('product-list');
    const filterBarEl = document.getElementById('filter-bar');
    let allProducts = [];

    // อ่านค่า ?mood=xxx จาก URL
    const urlParams = new URLSearchParams(window.location.search);
    const initialMoodParam = urlParams.get('mood');

    // หาค่า mood เริ่มต้นให้ตรงกับตัวเลือก (รองรับ case-insensitive)
    let activeMood = 'ทั้งหมด';
    if (initialMoodParam) {
        const matchedMood = MOODS.find(
            (m) => m.toLowerCase() === initialMoodParam.trim().toLowerCase()
        );
        if (matchedMood) activeMood = matchedMood;
    }

    // สร้างปุ่มกรองใน #filter-bar
    function renderFilterButtons() {
        if (!filterBarEl) return;
        filterBarEl.innerHTML = '';

        MOODS.forEach((mood) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = mood;
            btn.dataset.mood = mood;
            btn.className = `filter-btn ${mood === activeMood ? 'active' : ''}`;

            btn.addEventListener('click', () => {
                activeMood = mood;
                updateActiveButton();
                renderProducts();
                syncUrlParam(mood);
            });

            filterBarEl.appendChild(btn);
        });
    }

    // อัปเดตสถานะ active ของปุ่มกรอง
    function updateActiveButton() {
        if (!filterBarEl) return;
        const buttons = filterBarEl.querySelectorAll('button');
        buttons.forEach((btn) => {
            if (btn.dataset.mood === activeMood) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // อัปเดต URL query parameter โดยไม่รีโหลดหน้า
    function syncUrlParam(mood) {
        const url = new URL(window.location.href);
        if (mood === 'ทั้งหมด') {
            url.searchParams.delete('mood');
        } else {
            url.searchParams.set('mood', mood);
        }
        window.history.replaceState({}, '', url);
    }

    // แสดงรายการการ์ดสินค้าใน #product-list
    function renderProducts() {
        const filtered =
            activeMood === 'ทั้งหมด'
                ? allProducts
                : allProducts.filter(
                      (p) =>
                          p.mood &&
                          p.mood.toString().toLowerCase() === activeMood.toLowerCase()
                  );

        if (filtered.length === 0) {
            productListEl.innerHTML = `<p class="empty-state">ไม่พบสินค้าในหมวดหมู่ "${escapeHtml(activeMood)}"</p>`;
            return;
        }

        productListEl.innerHTML = filtered
            .map((product) => {
                const name = product.name || 'ไม่มีชื่อสินค้า';
                const price = Number(product.price) || 0;
                const mood = product.mood || '';
                const description = product.description || '';
                const image = product.image || '';

                const orderUrl = `order.html?item=${encodeURIComponent(name)}&price=${encodeURIComponent(price)}`;

                return `
                    <article class="product-card" data-mood="${escapeHtml(mood)}">
                        ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" class="product-image">` : ''}
                        <div class="product-body">
                            ${mood ? `<span class="product-mood">${escapeHtml(mood)}</span>` : ''}
                            <h3 class="product-title">${escapeHtml(name)}</h3>
                            ${description ? `<p class="product-desc">${escapeHtml(description)}</p>` : ''}
                            <div class="product-footer">
                                <span class="product-price">฿${price.toLocaleString()}</span>
                                <a href="${orderUrl}" class="btn-order">สั่งซื้อ</a>
                            </div>
                        </div>
                    </article>
                `;
            })
            .join('');
    }

    // โหลดข้อมูลจาก products.json
    renderFilterButtons();
    try {
        const response = await fetch('products.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        allProducts = Array.isArray(data) ? data : data.products || [];
        renderProducts();
    } catch (error) {
        console.error('ไม่สามารถโหลดข้อมูล products.json ได้:', error);
        productListEl.innerHTML = `<p class="error-state">เกิดข้อผิดพลาดในการโหลดรายการสินค้า กรุณาลองใหม่อีกครั้ง</p>`;
    }
}

/* ==========================================================================
   2. หน้าสั่งซื้อสินค้า (order.html)
   ========================================================================== */
function initOrderPage() {
    const orderForm = document.getElementById('orderForm');
    const itemsInput = document.getElementById('items');
    const totalInput = document.getElementById('total');

    // อ่าน item และ price จาก URL
    const urlParams = new URLSearchParams(window.location.search);
    const itemParam = urlParams.get('item') || '';
    const priceParam = urlParams.get('price') || '0';

    // เติมลง #items และ #total อัตโนมัติ (เติมทั้งสองช่องเสมอ)
    if (itemsInput) {
        itemsInput.value = itemParam;
    }
    if (totalInput) {
        totalInput.value = priceParam;
    }

    // จัดการเมื่อกด submit ฟอร์ม #orderForm
    orderForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const customerNameEl = document.getElementById('customerName') || orderForm.querySelector('[name="customerName"]');
        const contactEl = document.getElementById('contact') || orderForm.querySelector('[name="contact"]');
        const noteEl = document.getElementById('note') || orderForm.querySelector('[name="note"]');

        const payload = {
            customerName: customerNameEl ? customerNameEl.value.trim() : '',
            contact: contactEl ? contactEl.value.trim() : '',
            items: itemsInput ? itemsInput.value.trim() : '',
            total: totalInput ? totalInput.value.trim() : '',
            note: noteEl ? noteEl.value.trim() : '',
            timestamp: new Date().toISOString()
        };

        try {
            const rawExisting = localStorage.getItem(STORAGE_KEY);
            let orders = rawExisting ? JSON.parse(rawExisting) : [];
            if (!Array.isArray(orders)) {
                orders = [];
            }

            orders.push(payload);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));

            // Redirect ไปหน้า thankyou.html
            window.location.href = 'thankyou.html';
        } catch (error) {
            console.error('เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อลง localStorage:', error);
            alert('ไม่สามารถบันทึกข้อมูลคำสั่งซื้อได้ กรุณาตรวจสอบการตั้งค่าเบราว์เซอร์แล้วลองใหม่อีกครั้ง');
        }
    });
}

/* ==========================================================================
   3. หน้าจัดการคำสั่งซื้อ (admin.html)
   ========================================================================== */
function initAdminPage() {
    const table = document.getElementById('ordersTable');
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    let orders = [];
    try {
        const rawData = localStorage.getItem(STORAGE_KEY);
        const parsed = rawData ? JSON.parse(rawData) : [];
        if (Array.isArray(parsed)) {
            orders = parsed;
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการอ่านข้อมูลคำสั่งซื้อ:', error);
        orders = [];
    }

    // กรณีไม่มีคำสั่งซื้อ
    if (orders.length === 0) {
        const colCount = table.querySelectorAll('thead th').length || 6;
        tbody.innerHTML = `
            <tr>
                <td colspan="${colCount}" style="text-align: center;">ยังไม่มีคำสั่งซื้อ</td>
            </tr>
        `;
        return;
    }

    // เรียงลำดับจาก timestamp ล่าสุดขึ้นก่อน
    const sortedOrders = [...orders].sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
    });

    // Render รายการคำสั่งซื้อลง tbody
    tbody.innerHTML = sortedOrders
        .map((order) => {
            const formattedDate = order.timestamp
                ? new Date(order.timestamp).toLocaleString('th-TH')
                : '-';

            const totalDisplay =
                order.total !== undefined && order.total !== '' && !isNaN(Number(order.total))
                    ? Number(order.total).toLocaleString()
                    : escapeHtml(String(order.total || '-'));

            return `
                <tr>
                    <td>${escapeHtml(formattedDate)}</td>
                    <td>${escapeHtml(order.customerName || '-')}</td>
                    <td>${escapeHtml(order.contact || '-')}</td>
                    <td>${escapeHtml(order.items || '-')}</td>
                    <td>${totalDisplay}</td>
                    <td>${escapeHtml(order.note || '-')}</td>
                </tr>
            `;
        })
        .join('');
}

/* ==========================================================================
   Helper: ป้องกัน XSS เมื่อแทรกข้อความลง HTML
   ========================================================================== */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
