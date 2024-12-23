const { app, BrowserWindow, ipcMain } = require('electron');
require('dotenv').config();
const Binance = require('binance-api-node').default;
const sound = require("sound-play");
const wavPlayer = require('node-wav-player');
const axios = require('axios'); // axios 추가

let mainWindow;

const sendHttpRequest = async (side, positionType, { symbol, quantity, price }) => {
  try {
    let url;
    if (side === 'BUY') {
      url = `https://api.day.app/vmCNEvHr6DvQPAE8dE7foB/${'매수주문체결'}/${symbol}/${price}USD ${+quantity}개`;
    } else if (side === 'SELL') {
      url = `https://api.day.app/vmCNEvHr6DvQPAE8dE7foB/${'매도주문체결'}/${symbol}/${price}USD ${+quantity}개`;
    } else if (side === 'NEW') {
      url = `https://api.day.app/vmCNEvHr6DvQPAE8dE7foB/${'새로운주문'}/${symbol}/${price}USD ${+quantity}개`;
    }

    await axios.post(url, {
      sound: side === 'BUY' ? 'buy_order' : side === 'SELL' ? 'sell_order' : 'new_order'
    });
    console.log('HTTP 요청 전송 성공:', { side, positionType, symbol, quantity, price });
  } catch (error) {
    console.error('HTTP 요청 전송 실패:', error);
  }
};


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
  const ws = client.ws.futuresUser(async msg => {
    if (msg.eventType === 'ORDER_TRADE_UPDATE') {
      // 주문 체결 처리
      console.log(msg)
      if (msg.orderStatus === 'FILLED') {
        // 포지션 진입인지 종료인지 구분
        {
          if (msg.side === 'BUY') {
            await sendHttpRequest('BUY', 'LONG', { symbol: msg.symbol, quantity: msg.bidsNotional, price: msg.price }); // 심볼과 수량 추가
            wavPlayer.play({
                path: './sounds/buy.wav',
              }).catch((error) => {
                console.error(error);
              });
            console.log('롱 포지션 진입:', msg);
          } else if (msg.side === 'SELL') {
            await sendHttpRequest('SELL', 'LONG', { symbol: msg.symbol, quantity: msg.bidsNotional, price: msg.price }); // 심볼과 수량 추가
            wavPlayer.play({
                path: './sounds/sell.wav',
              }).catch((error) => {
                console.error(error);
              });
            console.log('롱 포지션 종료:', msg);
          }
        } {
          if (msg.side === 'SELL') {
            await sendHttpRequest('SELL', 'SHORT', { symbol: msg.symbol, quantity: msg.bidsNotional, price: msg.price }); // 심볼과 수량 추가
            wavPlayer.play({
                path: './sounds/sell.wav',
              }).catch((error) => {
                console.error(error);
              });
            console.log('숏 포지션 진입:', msg);
          } else if (msg.side === 'BUY') {
            await sendHttpRequest('BUY', 'SHORT', { symbol: msg.symbol, quantity: msg.bidsNotional, price: msg.price }); // 심볼과 수량 추가
            wavPlayer.play({
                path: './sounds/buy.wav',
              }).catch((error) => {
                console.error(error);
              });
              
            console.log('숏 포지션 종료:', msg);
          }
        }
      } else if (msg.orderStatus === 'NEW' || msg.orderStatus === 'CANCELED') {
        // 열린 주문 처리
        console.log('열린 주문:', msg);
        await sendHttpRequest('NEW', 'ORDER', { symbol: msg.symbol, quantity: msg.bidsNotional, price: msg.price }); // 심볼과 수량 추가

        // wavPlayer.play({
        //     path: './sounds/open.wav',
        //   }).catch((error) => {
        //     console.error(error);
        //   });
      }
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
  setInterval(getPositionInfo, 1000);

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
