import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";
import "dotenv/config";

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // Tách phần số tiền (từ đầu đến khoảng trắng đầu tiên) và phần còn lại
  const firstSpaceIndex = text.indexOf(" ");
  if (firstSpaceIndex === -1) {
    bot.sendMessage(
      chatId,
      'Vui lòng nhập đúng định dạng: \n\n1. "+số tiền ghi chú" (Thu tiền)\n2. "số tiền ghi chú" (Chi tiêu)',
      {
        parse_mode: "Markdown",
      }
    );
    return;
  }

  const rawAmount = text.slice(0, firstSpaceIndex).trim(); // Phần số tiền
  const note = text.slice(firstSpaceIndex + 1).trim(); // Phần ghi chú

  const now = new Date();
  const formattedTime =
    now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) +
    " " +
    now.toLocaleDateString("vi-VN");

  // Hàm chuyển đổi chuỗi số tiền sang số nguyên
  const parseAmount = (input) => {
    const match = input.match(/^(\+)?(\d+)(k|m)?(\d+)?$/i);
    if (!match) return NaN;

    const isIncome = match[1] === "+";
    const mainPart = parseInt(match[2], 10); // Phần chính
    const unit = match[3] ? match[3].toLowerCase() : ""; // Đơn vị (k hoặc m)
    const decimalPart = match[4] ? parseInt(match[4], 10) : 0; // Phần lẻ (nếu có)

    let value = mainPart;

    if (unit === "k") {
      value *= 1000;
    } else if (unit === "m") {
      value *= 1000000;
      value += decimalPart * 1000; // Thêm phần lẻ
    }

    return isIncome ? value : value; // Trả về số tiền
  };

  const amount = parseAmount(rawAmount);

  // Xác định loại giao dịch
  const type = rawAmount.startsWith("+") ? "Thu nhập" : "Chi tiêu";

  if (isNaN(amount) || amount <= 0) {
    bot.sendMessage(chatId, "Số tiền không hợp lệ. Vui lòng kiểm tra lại.");
    return;
  }

  const data = {
    timestamp: formattedTime,
    type,
    amount,
    note,
  };

  const url = new URL(process.env.WEBHOOK_URL);
  url.searchParams.append("timestamp", data.timestamp);
  url.searchParams.append("type", data.type);
  url.searchParams.append("amount", data.amount);
  url.searchParams.append("note", data.note);

  bot.sendChatAction(chatId, "typing");

  fetch(url)
    .then((res) => res.json())
    .then((response) => {
      if (response.status === "success") {
        bot.sendMessage(
          chatId,
          `✅ Giao dịch đã được ghi nhận:\n\n⏰ **Thời gian:** ${
            data.timestamp
          }\n💰 **Số tiền:** ${data.amount.toLocaleString()} VND\n📂 **Loại tiền:** ${
            data.type
          }\n📝 **Nội dung:** ${data.note}`,
          {
            parse_mode: "Markdown",
          }
        );
      } else {
        bot.sendMessage(
          chatId,
          "Không thể ghi nhận giao dịch. Vui lòng thử lại sau!"
        );
      }
    })
    .catch((err) => {
      console.error(err);
      bot.sendMessage(chatId, "Đã có lỗi xảy ra. Vui lòng thử lại sau!");
    });
});

console.log("Expense manager bot is running...");
