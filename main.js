const { app, BrowserWindow, ipcMain } = require('electron');
require('dotenv').config();
const Binance = require('binance-api-node').default;
const sound = require("sound-play");
const wavPlayer = require('node-wav-player');

let mainWindow;

// Binance 선물 클스트넷 클라이언트 초기화
const client = Binance({
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_SECRET,
    futures: true,

});

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  // 선물 웹소켓을 통해 실시간 거래 데이터 수신
  const ws = client.ws.futuresUser(msg => {
    if (msg.eventType === 'ORDER_TRADE_UPDATE' && msg.orderStatus === 'FILLED') {
      // 포지션 진입인지 종료인지 구분
      if (msg.positionSide === 'LONG') {
        if (msg.side === 'BUY') {
          console.log('롱 포지션 진입:', msg);
          wavPlayer.play({
            path: './sounds/open.wav',
          }).catch((error) => {
            console.error(error);
          });
        } else if (msg.side === 'SELL') {
          console.log('롱 포지션 종료:', msg);
          wavPlayer.play({
            path: './sounds/close.wav',
          }).catch((error) => {
            console.error(error);
          }); 
        }
      } else if (msg.positionSide === 'SHORT') {
        if (msg.side === 'SELL') {
          console.log('숏 포지션 진입:', msg);
          wavPlayer.play({
            path: './sounds/open.wav',
          }).catch((error) => {
            console.error(error);
          });
        } else if (msg.side === 'BUY') {
          console.log('숏 포지션 종료:', msg);
          wavPlayer.play({
            path: './sounds/close.wav',
          }).catch((error) => {
            console.error(error);
          });
        }
      }
      
      mainWindow.webContents.send('order-filled', msg);
    }
  });

  // 실시간 선물 포지션 정보 가져오기
  const getPositionInfo = async () => {
    
    try {

      const positions = await client.futuresPositionRisk();
      const activePositions = positions.filter(position => 
        parseFloat(position.positionAmt) !== 0
      );
      mainWindow.webContents.send('position-update', activePositions);
    } catch (error) {
      console.error('선물 포지션 정보 조회 중 오류 발생:', error);
    }
  };

  // 주기적으로 포지션 정보 업데이트 (예: 3초마다)
  setInterval(getPositionInfo, 3000);

  // 초기 선물 거래 내역 가져오기
  ipcMain.handle('fetch-initial-orders', async (event) => {
    try {
      const trades = await client.futuresUserTrades({ symbol: 'BTCUSDT' });
      return trades;
    } catch (error) {
      console.error('선물 API 요청 중 오류 발생:', error);
      return { error: '선물 API 요청 실패' };
    }
  });

  // 초기 선물 포지션 정보 요청 처리
  ipcMain.handle('fetch-positions', async (event) => {
    try {
      const positions = await client.futuresPositionRisk();
      return positions.filter(position => parseFloat(position.positionAmt) !== 0);
    } catch (error) {
      console.error('선물 포지션 정보 조회 중 오류 발생:', error);
      return { error: '선물 포지션 정보 조회 실패' };
    }
  });
});
