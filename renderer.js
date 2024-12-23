const { ipcRenderer } = require('electron');

// 차트 데이터 관리를 위한 변수들
let pnlData = {
    labels: [],
    values: []
};

// 포지션 데이터를 저장할 객체
let positions = new Map();

// 초대 수익 및 최대 손실을 저장할 변수
let maxProfit = 0;
let maxLoss = 0;

// 초기 데이터 로드
// document.getElementById('fetchOrdersBtn').addEventListener('click', async () => {
//     const trades = await ipcRenderer.invoke('fetch-initial-orders');
//     updateOrderList(trades);
//     await updatePositions();
// });

// 실시간 주문 체결 업데이트
ipcRenderer.on('order-filled', (event, order) => {
    addOrderToList(order);
    updatePositions();
});

// 실시간 포지션 업데이트
ipcRenderer.on('position-update', (event, positionData) => {
    updatePositionsList(positionData);
    updatePnLChart(positionData);
    updateTotalPnL(positionData);
});

// 주문 내역을 리스트에 추가하는 함수
function addOrderToList(order) {
    const orderList = document.getElementById('orderList');
    const li = document.createElement('li');
    li.className = 'p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow';
    
    const side = order.side === 'BUY' ? 
        '<span class="text-green-600">매수</span>' : 
        '<span class="text-red-600">매도</span>';
    
    li.innerHTML = `
        <div class="flex justify-between items-center">
            <div>
                <span class="font-semibold">${order.symbol}</span>
                ${side}
            </div>
            <div class="text-gray-600">
                가격: ${parseFloat(order.price).toFixed(2)} USDT
                수량: ${parseFloat(order.quantity).toFixed(3)}
            </div>
        </div>
    `;
    
    orderList.insertBefore(li, orderList.firstChild);
    
    // 최대 50개까지만 표시
    if (orderList.children.length > 50) {
        orderList.removeChild(orderList.lastChild);
    }
}

// 포지션 목록 업데이트
function updatePositionsList(positionData) {
    const positionList = document.getElementById('positionList');
    positionList.innerHTML = '';

    positionData.forEach(position => {
        if (parseFloat(position.positionAmt) === 0) return;

        const pnl = parseFloat(position.unRealizedProfit);
        const entryPrice = parseFloat(position.entryPrice);
        const markPrice = parseFloat(position.markPrice);
        const pnlPercentage = ((markPrice - entryPrice) / entryPrice * 100 * 
            (position.positionAmt > 0 ? 1 : -1)).toFixed(2);

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        tr.innerHTML = `
            <td class="px-4 py-2">${position.symbol}</td>
            <td class="px-4 py-2">
                <span class="${position.positionAmt > 0 ? 'text-green-600' : 'text-red-600'}">
                    ${position.positionAmt > 0 ? '롱' : '숏'}
                </span>
            </td>
            <td class="px-4 py-2">${entryPrice.toFixed(2)}</td>
            <td class="px-4 py-2">${Math.abs(parseFloat(position.positionAmt))}</td>
            <td class="px-4 py-2">${position.leverage}x</td>
            <td class="px-4 py-2 ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                ${pnl.toFixed(2)} USDT
            </td>
            <td class="px-4 py-2 ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                ${pnlPercentage}%
            </td>
        `;
        positionList.appendChild(tr);
    });

    // 총 포지션 수 업데이트
    document.getElementById('totalPositions').textContent = 
        positionData.filter(p => parseFloat(p.positionAmt) !== 0).length;
}

// PnL 차트 업데이트
function updatePnLChart(positionData) {
    const totalPnL = positionData.reduce((sum, position) => 
        sum + parseFloat(position.unRealizedProfit), 0);

    const now = new Date().toLocaleTimeString();
    
    // 데이터 추가
    pnlData.labels.push(now);
    pnlData.values.push(totalPnL);

    // 최대 20개의 데이터 포인트만 유지 (30개에서 20개로 줄임)
    if (pnlData.labels.length > 20) {
        // 한 번에 5개의 오래된 데이터 제거
        pnlData.labels = pnlData.labels.slice(-20);
        pnlData.values = pnlData.values.slice(-20);
    }

    // 차트 업데이트 최적화
    pnlChart.data.labels = [...pnlData.labels];
    pnlChart.data.datasets[0].data = [...pnlData.values];
    
    // 애니메이션 지속 시간 단축

    pnlChart.update();  // 'none' 모드로 업데이트하여 성능 향상
}

// 총 수익/손실 업데이트
function updateTotalPnL(positionData) {
    const totalPnL = positionData.reduce((sum, position) => 
        sum + parseFloat(position.unRealizedProfit), 0);
    
    // 원화로 변환 (예: 1 USDT = 1300 KRW)
    const exchangeRate = 1436.22; // 환율 설정
    const totalPnLInKRW = totalPnL * exchangeRate;

    const totalPnLElement = document.getElementById('totalPnL');
    totalPnLElement.textContent = `${totalPnL.toFixed(2)} USDT (${totalPnLInKRW.toFixed(0)} KRW)`;
    totalPnLElement.className = totalPnL >= 0 ? 'text-2xl font-bold text-green-600' : 
        'text-2xl font-bold text-red-600';

    // 최대 수익 및 최대 손실 업데이트
    if (totalPnL > maxProfit) {
        maxProfit = totalPnL;
    }
    if (totalPnL < maxLoss) {
        maxLoss = totalPnL;
    }

    // 최대 수익 및 최대 손실 표시 업데이트
    document.getElementById('maxProfit').textContent = `최대 수익: ${maxProfit.toFixed(2)} USDT (${(maxProfit * exchangeRate).toFixed(0)} KRW)`;
    document.getElementById('maxLoss').textContent = `최대 손실: ${maxLoss.toFixed(2)} USDT (${(maxLoss * exchangeRate).toFixed(0)} KRW)`;
}

// 초기 포지션 정보 가져오기
async function updatePositions() {
    const positions = await ipcRenderer.invoke('fetch-positions');
    updatePositionsList(positions);
    updatePnLChart(positions);
    updateTotalPnL(positions);
    updateProfitPercentageChart(positions);
}

// 페이지 로드 시 초기 데이터 가져오기
window.addEventListener('DOMContentLoaded', () => {
    updatePositions(); // 초기 데이터 로드
    setInterval(updatePositions, 1000); // 1초마다 업데이트
});

// 테마 토글 기능
const themeToggle = document.getElementById('themeToggle');
const lightIcon = document.getElementById('lightIcon');
const darkIcon = document.getElementById('darkIcon');

// 저장된 테마 불러오기
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcons(savedTheme);
}

themeToggle.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  // 차트 색상 업데이트
  if (newTheme === 'dark') {
    pnlChart.options.scales.x.grid.color = 'rgba(255, 255, 255, 0.1)';
    pnlChart.options.scales.y.grid.color = 'rgba(255, 255, 255, 0.1)';
    pnlChart.options.scales.x.ticks.color = '#fff';
    pnlChart.options.scales.y.ticks.color = '#fff';
  } else {
    pnlChart.options.scales.x.grid.color = 'rgba(0, 0, 0, 0.1)';
    pnlChart.options.scales.y.grid.color = 'rgba(0, 0, 0, 0.1)';
    pnlChart.options.scales.x.ticks.color = '#666';
    pnlChart.options.scales.y.ticks.color = '#666';
  }
  pnlChart.update();
  
  updateThemeIcons(newTheme);
});

function updateThemeIcons(theme) {
  if (theme === 'dark') {
    lightIcon.classList.add('hidden');
    darkIcon.classList.remove('hidden');
  } else {
    lightIcon.classList.remove('hidden');
    darkIcon.classList.add('hidden');
  }
}

// 각 코인별 수익 비율 차트 초기화
const ctxProfitPercentage = document.getElementById('profitPercentageChart').getContext('2d');
const profitPercentageChart = new Chart(ctxProfitPercentage, {
    type: 'pie',
    data: {
        labels: [], // 코인 이름
        datasets: [{
            label: '각 코인별 수익 비율',
            data: [], // 수익 비율 데이터
            backgroundColor: [
                'rgba(75, 192, 192, 0.6)',
                'rgba(255, 99, 132, 0.6)',
                'rgba(255, 206, 86, 0.6)',
                'rgba(54, 162, 235, 0.6)',
                'rgba(153, 102, 255, 0.6)',
            ],
            borderColor: 'rgba(255, 255, 255, 1)',
            borderWidth: 1
        }]
    },
    options: {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
            },
            tooltip: {
                callbacks: {
                    label: function(tooltipItem) {
                        return `${tooltipItem.label}: ${tooltipItem.raw.toFixed(2)}%`;
                    }
                }
            }
        }
    }
});

// 각 코인별 수익 비율 업데이트 함수
function updateProfitPercentageChart(positionData) {
    const labels = [];
    const data = [];

    positionData.forEach(position => {
        if (parseFloat(position.positionAmt) !== 0) {
            labels.push(position.symbol);
            const pnlPercentage = ((parseFloat(position.unRealizedProfit) / parseFloat(position.entryPrice)) * 100).toFixed(2);
            data.push(parseFloat(pnlPercentage));
        }
    });

    profitPercentageChart.data.labels = labels;
    profitPercentageChart.data.datasets[0].data = data;
    profitPercentageChart.update();
}
