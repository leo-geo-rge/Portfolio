const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");
const session = require("express-session");

const app = express();

app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

app.use(session({
    secret: "secretkey",
    resave: false,
    saveUninitialized: true
}));


// ================= DATABASE =================
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Leo@Mysql2006",
    database: "CollegeEventDB"
});

db.connect(err => {
    if (err) console.error(err);
    else console.log("Connected to MySQL");
});


// ================= LOGIN =================
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    db.query(
        "SELECT * FROM Users WHERE username = ? AND password = ?",
        [username, password],
        (err, results) => {
            if (err) return res.status(500).send(err);

            if (results.length > 0) {
                req.session.user = results[0];

                res.json({
                    message: "Login Successful",
                    role: results[0].role,
                    user_id: results[0].user_id   // ✅ ADD THIS
                });
            } else {
                res.status(401).send("Invalid Credentials");
            }
        }
    );
});
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.send("Logged out");
});


// ================= REGISTER =================
app.post("/register", (req, res) => {
    const { username, password } = req.body;

    db.query("SELECT * FROM Users WHERE username = ?", [username], (err, results) => {
        if (err) return res.status(500).send(err);

        if (results.length > 0) {
            return res.status(400).send("Username already exists");
        }

        db.query(
            "INSERT INTO Users (username, password, role) VALUES (?, ?, 'student')",
            [username, password],
            (err2) => {
                if (err2) return res.status(500).send(err2);
                res.send("Student Account Created Successfully!");
            }
        );
    });
});


// ================= EVENTS =================
app.post("/add-event", (req, res) => {
    const { event_name, event_type, event_date, venue } = req.body;

    db.query(
        "INSERT INTO Event (event_name, event_type, event_date, venue) VALUES (?, ?, ?, ?)",
        [event_name, event_type, event_date, venue],
        (err) => {
            if (err) return res.status(500).send(err);
            res.send("Event Created Successfully!");
        }
    );
});

app.get("/events", (req, res) => {
    db.query("SELECT * FROM Event", (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});


// ================= ASSIGN BUDGET =================
app.post("/assign-budget", (req, res) => {
    const { event_id, allocated_amount } = req.body;

    db.query("SELECT * FROM Budget WHERE event_id = ?", [event_id], (err, results) => {
        if (err) return res.status(500).send(err);

        if (results.length > 0) {
            return res.status(400).send("Budget already assigned");
        }

        db.query(
            `INSERT INTO Budget 
            (event_id, allocated_amount, approved_amount, status)
            VALUES (?, ?, 0, 'Pending')`,
            [event_id, allocated_amount],
            (err2) => {
                if (err2) return res.status(500).send(err2);
                res.send("Budget Assigned (Pending Approval)");
            }
        );
    });
});


// ================= VIEW BUDGETS (STUDENT PAGE) =================
app.get("/budgets", (req, res) => {

    db.query(`
        SELECT b.budget_id,
               e.event_name,
               b.allocated_amount,
               b.approved_amount,
               b.status
        FROM Budget b
        JOIN Event e ON b.event_id = e.event_id
    `, (err, budgets) => {

        if (err) return res.status(500).send(err);

        db.query(
            `SELECT IFNULL(SUM(approved_amount),0) AS totalApproved
             FROM Budget
             WHERE status = 'Approved'`,
            (err2, result) => {

                if (err2) return res.status(500).send(err2);

                res.json({
                    budgets: budgets,
                    totalApproved: result[0].totalApproved
                });
            }
        );
    });
});


// ================= VIEW BUDGET STATUS (ADMIN PAGE) =================
app.get("/budget-status", (req, res) => {

    db.query(`
        SELECT b.budget_id,
               e.event_name,
               b.allocated_amount,
               b.approved_amount,
               b.status
        FROM Budget b
        JOIN Event e ON b.event_id = e.event_id
    `, (err, results) => {

        if (err) return res.status(500).send(err);
        res.json(results);
    });
});


// ================= APPROVE =================
app.post("/approve-budget/:id", (req, res) => {

    const budgetId = req.params.id;

    db.query(
        `UPDATE Budget 
         SET status = 'Approved',
             approved_amount = allocated_amount
         WHERE budget_id = ?`,
        [budgetId],
        (err) => {
            if (err) return res.status(500).send(err);
            res.send("Budget Approved");
        }
    );
});


// ================= REJECT =================
app.post("/reject-budget/:id", (req, res) => {

    const budgetId = req.params.id;

    db.query(
        `UPDATE Budget 
         SET status = 'Rejected',
             approved_amount = 0
         WHERE budget_id = ?`,
        [budgetId],
        (err) => {
            if (err) return res.status(500).send(err);
            res.send("Budget Rejected");
        }
    );
});


// ================= ADD EXPENSE =================
app.post("/add-expense", (req, res) => {

    const { event_id, expense_type, amount, expense_date } = req.body;

    db.query(
        "SELECT approved_amount FROM Budget WHERE event_id = ? AND status = 'Approved'",
        [event_id],
        (err, results) => {

            if (err) return res.status(500).send(err);

            if (results.length === 0) {
                return res.status(400).send("Budget not approved for this event");
            }

            const approvedAmount = results[0].approved_amount;

            db.query(
                "SELECT IFNULL(SUM(amount),0) AS total FROM Expense WHERE event_id = ?",
                [event_id],
                (err2, result2) => {

                    if (err2) return res.status(500).send(err2);

                    const totalExpense = result2[0].total;

                    if (totalExpense + parseFloat(amount) > approvedAmount) {
                        return res.status(400).send("Expense exceeds approved budget");
                    }

                    db.query(
                        "INSERT INTO Expense (event_id, expense_type, amount, expense_date) VALUES (?, ?, ?, ?)",
                        [event_id, expense_type, amount, expense_date],
                        (err3) => {
                            if (err3) return res.status(500).send(err3);
                            res.send("Expense Added Successfully!");
                        }
                    );
                }
            );
        }
    );
});


// ================= VIEW EXPENSES =================
app.get("/expenses", (req, res) => {

    db.query(`
        SELECT ex.expense_id,
               e.event_name,
               ex.expense_type,
               ex.amount,
               ex.expense_date
        FROM Expense ex
        JOIN Event e ON ex.event_id = e.event_id
        ORDER BY ex.expense_date DESC
    `, (err, results) => {

        if (err) return res.status(500).send(err);
        res.json(results);
    });
});


// ================= SPONSORS =================
app.post("/add-sponsor", (req, res) => {
    const { sponsor_name, company, contact_no } = req.body;

    db.query(
        "INSERT INTO Sponsor (sponsor_name, company, contact_no) VALUES (?, ?, ?)",
        [sponsor_name, company, contact_no],
        (err) => {
            if (err) return res.status(500).send(err);
            res.send("Sponsor Added Successfully!");
        }
    );
});

app.get("/sponsors", (req, res) => {
    db.query("SELECT * FROM Sponsor", (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

app.post("/assign-sponsor", (req, res) => {
    const { sponsor_id, event_id, amount } = req.body;

    db.query(
        "INSERT INTO Sponsorship (event_id, sponsor_id, amount) VALUES (?, ?, ?)",
        [event_id, sponsor_id, amount],
        (err) => {
            if (err) return res.status(500).send(err);
            res.send("Sponsor Assigned Successfully!");
        }
    );
});

app.get("/sponsorships", (req, res) => {
    db.query(`
        SELECT sp.sponsorship_id,
               s.sponsor_name,
               e.event_name,
               sp.amount
        FROM Sponsorship sp
        JOIN Sponsor s ON sp.sponsor_id = s.sponsor_id
        JOIN Event e ON sp.event_id = e.event_id
    `, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

// ================= REGISTER FOR EVENT =================
app.post("/register-event", (req, res) => {

    const { user_id, event_id, student_name, department, year } = req.body;

    db.query(
        `INSERT INTO Participant 
        (user_id, event_id, student_name, department, year)
        VALUES (?, ?, ?, ?, ?)`,
        [user_id, event_id, student_name, department, year],
        (err) => {

            if(err){
                if(err.code === "ER_DUP_ENTRY"){
                    return res.status(400).send("Already Registered!");
                }
                return res.status(500).send(err);
            }

            res.send("Registered Successfully!");
        }
    );
});

app.get("/my-events/:userId", (req, res) => {

    const userId = req.params.userId;

    db.query(`
        SELECT e.event_id,
               e.event_name,
               e.event_date
        FROM Participant p
        INNER JOIN Event e 
            ON p.event_id = e.event_id
        WHERE p.user_id = ?
    `, [userId], (err, results) => {

        if (err) {
            console.error(err);
            return res.status(500).send(err);
        }

        res.json(results);
    });
});

// ================= VIEW PARTICIPANTS =================
app.get("/participants/:eventId", (req, res) => {

    const eventId = req.params.eventId;

    db.query(`
        SELECT student_name, department, year, registration_date
        FROM Participant
        WHERE event_id = ?
    `,[eventId], (err, results)=>{
        if(err) res.status(500).send(err);
        else res.json(results);
    });
});

app.post("/create-committee", (req, res) => {

    const { committee_name, event_id, head_student_id } = req.body;

    db.query(
        "INSERT INTO committee (committee_name, event_id, head_student_id) VALUES (?, ?, ?)",
        [committee_name, event_id, head_student_id],
        (err, result) => {
            if (err) return res.status(500).send(err);
            res.send("Committee Created Successfully");
        }
    );
});

app.post("/add-committee-member", (req, res) => {

    const { committee_id, student_id, role } = req.body;

    db.query(
        "INSERT INTO committee_member (committee_id, student_id, role) VALUES (?, ?, ?)",
        [committee_id, student_id, role],
        (err, result) => {
            if (err) return res.status(500).send(err);
            res.send("Member Added Successfully");
        }
    );
});

app.get("/committee/:eventId", (req, res) => {

    const eventId = req.params.eventId;

    db.query(`
        SELECT 
            c.committee_name,
            s.username AS student_name,
            cm.role
        FROM committee c
        JOIN committee_member cm 
            ON c.committee_id = cm.committee_id
        JOIN users s 
            ON cm.student_id = s.user_id
        WHERE c.event_id = ?
    `, [eventId], (err, results) => {

        if (err) return res.status(500).send(err);

        res.json(results);
    });
});
// Get students
app.get("/students", (req,res)=>{
    db.query("SELECT user_id, username FROM users WHERE role='student'",
    (err,result)=>{
        if(err) return res.status(500).send(err);
        res.json(result);
    });
});

// Get committees
app.get("/committees", (req,res)=>{
    db.query("SELECT committee_id, committee_name FROM committee",
    (err,result)=>{
        if(err) return res.status(500).send(err);
        res.json(result);
    });
});

// ================= SERVER =================
app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});