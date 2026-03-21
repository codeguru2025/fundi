import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface Sale {
  id: string;
  book_id: string;
  buyer_id: string | null;
  seller_id: string;
  amount: number;
  paynow_reference: string | null;
  status: string;
  created_at: Date;
}

interface RepairReport {
  totalSales: number;
  bookPurchasesRepaired: number;
  coursePurchasesRepaired: number;
  alreadyCorrect: number;
  failures: string[];
}

async function repairPurchases() {
  const report: RepairReport = {
    totalSales: 0,
    bookPurchasesRepaired: 0,
    coursePurchasesRepaired: 0,
    alreadyCorrect: 0,
    failures: [],
  };

  console.log("=== PURCHASE REPAIR SCRIPT ===\n");

  const salesResult = await pool.query<Sale>(
    "SELECT * FROM sales WHERE status = 'completed' ORDER BY created_at"
  );
  report.totalSales = salesResult.rows.length;
  console.log(`Found ${report.totalSales} completed sales\n`);

  for (const sale of salesResult.rows) {
    const buyerId = sale.buyer_id;
    if (!buyerId) {
      report.failures.push(`Sale ${sale.id}: no buyer_id, cannot repair`);
      console.log(`[SKIP] Sale ${sale.id} - no buyer_id`);
      continue;
    }

    const itemId = sale.book_id;
    console.log(`\nProcessing sale ${sale.id}: item=${itemId}, buyer=${buyerId}`);

    const isBook = await pool.query("SELECT id FROM books WHERE id = $1", [itemId]);
    const isCourse = await pool.query("SELECT id FROM courses WHERE id = $1", [itemId]);

    if (isBook.rows.length > 0) {
      const existing = await pool.query(
        "SELECT id FROM purchases WHERE book_id = $1 AND buyer_token = $2",
        [itemId, buyerId]
      );

      if (existing.rows.length > 0) {
        console.log(`  [OK] Book purchase already exists`);
        report.alreadyCorrect++;
      } else {
        try {
          await pool.query(
            `INSERT INTO purchases (id, book_id, buyer_token, paynow_reference, created_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
            [itemId, buyerId, sale.paynow_reference, sale.created_at]
          );
          console.log(`  [REPAIRED] Created book purchase for buyer ${buyerId}`);
          report.bookPurchasesRepaired++;
        } catch (err: any) {
          report.failures.push(`Sale ${sale.id}: failed to create book purchase - ${err.message}`);
          console.log(`  [FAIL] ${err.message}`);
        }
      }
    } else if (isCourse.rows.length > 0) {
      const existing = await pool.query(
        "SELECT id FROM course_purchases WHERE course_id = $1 AND buyer_token = $2",
        [itemId, buyerId]
      );

      if (existing.rows.length > 0) {
        console.log(`  [OK] Course purchase already exists`);
        report.alreadyCorrect++;
      } else {
        try {
          await pool.query(
            `INSERT INTO course_purchases (id, course_id, buyer_token, paynow_reference, created_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
            [itemId, buyerId, sale.paynow_reference, sale.created_at]
          );
          console.log(`  [REPAIRED] Created course purchase for buyer ${buyerId}`);
          report.coursePurchasesRepaired++;
        } catch (err: any) {
          report.failures.push(`Sale ${sale.id}: failed to create course purchase - ${err.message}`);
          console.log(`  [FAIL] ${err.message}`);
        }
      }
    } else {
      report.failures.push(`Sale ${sale.id}: item ${itemId} not found in books or courses`);
      console.log(`  [SKIP] Item ${itemId} not found in either table`);
    }
  }

  console.log("\n\n=== REPAIR REPORT ===");
  console.log(`Total completed sales:     ${report.totalSales}`);
  console.log(`Already correct:           ${report.alreadyCorrect}`);
  console.log(`Book purchases repaired:   ${report.bookPurchasesRepaired}`);
  console.log(`Course purchases repaired: ${report.coursePurchasesRepaired}`);
  console.log(`Failures:                  ${report.failures.length}`);
  if (report.failures.length > 0) {
    console.log("\nFailure details:");
    report.failures.forEach((f) => console.log(`  - ${f}`));
  }

  console.log("\n\n=== CHECKING ORPHANED PENDING PAYMENTS ===");
  const pendingBooks = await pool.query(
    "SELECT id, book_id, buyer_token, status, amount FROM pending_payments WHERE status = 'completed'"
  );
  const pendingCourses = await pool.query(
    "SELECT id, course_id, buyer_token, status, amount FROM course_pending_payments WHERE status = 'completed'"
  );

  let pendingRepaired = 0;
  for (const pp of pendingBooks.rows) {
    const existing = await pool.query(
      "SELECT id FROM purchases WHERE book_id = $1 AND buyer_token = $2",
      [pp.book_id, pp.buyer_token]
    );
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO purchases (id, book_id, buyer_token, created_at)
         VALUES (gen_random_uuid(), $1, $2, NOW())`,
        [pp.book_id, pp.buyer_token]
      );
      console.log(`[REPAIRED] Missing book purchase from completed pending payment: book=${pp.book_id}, buyer=${pp.buyer_token}`);
      pendingRepaired++;
    }
  }

  for (const pp of pendingCourses.rows) {
    const existing = await pool.query(
      "SELECT id FROM course_purchases WHERE course_id = $1 AND buyer_token = $2",
      [pp.course_id, pp.buyer_token]
    );
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO course_purchases (id, course_id, buyer_token, created_at)
         VALUES (gen_random_uuid(), $1, $2, NOW())`,
        [pp.course_id, pp.buyer_token]
      );
      console.log(`[REPAIRED] Missing course purchase from completed pending payment: course=${pp.course_id}, buyer=${pp.buyer_token}`);
      pendingRepaired++;
    }
  }

  console.log(`\nPending payment repairs: ${pendingRepaired}`);

  console.log("\n\n=== CURRENT STATE ===");
  const bookPurchases = await pool.query("SELECT COUNT(*)::int as count FROM purchases");
  const coursePurchases = await pool.query("SELECT COUNT(*)::int as count FROM course_purchases");
  const sales = await pool.query("SELECT COUNT(*)::int as count FROM sales WHERE status = 'completed'");
  console.log(`Book purchases:   ${bookPurchases.rows[0].count}`);
  console.log(`Course purchases: ${coursePurchases.rows[0].count}`);
  console.log(`Completed sales:  ${sales.rows[0].count}`);

  console.log("\n=== REPAIR COMPLETE ===");
  await pool.end();
}

repairPurchases().catch((err) => {
  console.error("Repair script failed:", err);
  process.exit(1);
});
