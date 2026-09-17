# Hướng dẫn Thiết lập Cloudflare Email Routing cho mailtion.com

## Bước 1: Kích hoạt Cloudflare Email Routing
1. Truy cập [Cloudflare Dashboard](https://dash.cloudflare.com/) -> Chọn tên miền `mailtion.com`.
2. Vào mục **Email** -> **Email Routing**.
3. Bấm **Enable Email Routing**. Cloudflare sẽ tự động thêm các bản ghi MX và TXT (SPF) cần thiết vào DNS của bạn.

## Bước 2: Cài đặt và Triển khai Email Worker
1. Mở terminal tại thư mục `cloudflare-worker`:
   ```bash
   cd cloudflare-worker
   npm install
   ```
2. Đăng nhập tài khoản Cloudflare (nếu chưa):
   ```bash
   npx wrangler login
   ```
3. Cập nhật `wrangler.toml`:
   - `DASHBOARD_WEBHOOK_URL`: Đường dẫn API nhận thư trên VPS của bạn (vd: `https://your-domain.com/api/webhook/email`).
   - `WEBHOOK_SECRET`: Khớp với chuỗi Secret Key trong bảng cài đặt Admin Dashboard.
4. Triển khai Worker lên Cloudflare:
   ```bash
   npx wrangler deploy
   ```

## Bước 3: Định tuyến Email tới Worker
1. Quay lại trang **Cloudflare Dashboard** -> **Email Routing** -> Tab **Routing rules**.
2. Tại mục **Catch-all address**:
   - Chọn **Action**: `Send to a Worker`.
   - Chọn **Worker**: `mailtion-email-router`.
3. Bấm **Save**. Bây giờ toàn bộ email gửi đến `bất_kỳ_tên@mailtion.com` sẽ tự động được Worker nhận, bóc tách và gửi về máy chủ VPS của bạn!
