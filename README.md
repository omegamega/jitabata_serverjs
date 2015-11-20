# jitabata_serverjs
TWE-lite(製造元 TOCOS http://mono-wireless.com/jp/products/TWE-001Lite.html
)を利用したラジコンボート作りの、統括制御サーバです。

各ラジコン子機はTWE-liteを子機モードで乗せ、ToCoStickを付けたPC(以下サーバという)上でjitabata_serverjsを走らせます。各ユーザはタブレットやスマートフォン等でサーバへ接続してラジコン子機を制御します

# 要件

* node
* serialport
* express

# 使いかた

`node server.js [portname]`

[portname]にはToCoStickのシリアルポート・デバイス名を指定します。WindowsであればCOM3,COM5などをデバイスマネージャで確認します。Mac/Linuxでは/dev/tty.usbserial-XXXXXXを探して指定します。

サーバが起動したら、ブラウザからhttp://localhost:8000/をアクセスします。

現状ToCoStickの通信すべてを標準出力に出しています。ToCoStickが動作し、動作中のTWE-liteが近くに存在いれば受信ログを見ることができるはずです。

# UI

todo

