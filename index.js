const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = 3000;

// Middleware for parsing request bodies
app.use(bodyParser.urlencoded({ extended: true }));

// Set EJS as the templating engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Connect to SQLite database
const db = new sqlite3.Database("./fast_cab.db", (err) => {
    if (err) {
        console.error("Error connecting to the database:", err.message);
    } else {
        console.log("Connected to the fast_cab.db database.");
    }
});

// Route: Homepage - Menu
app.get("/", (req, res) => {
    res.render("menu");
});

// Route: Display table list for selected action
app.get("/:action", (req, res) => {
    const action = req.params.action;
    const validActions = ["view", "add", "delete", "update"];
    if (!validActions.includes(action)) {
        return res.status(400).send("Invalid action.");
    }

    const query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
    db.all(query, [], (err, tables) => {
        if (err) {
            console.error(err.message);
            res.status(500).send("Error retrieving tables.");
        } else {
            res.render("table_list", { action, tables });
        }
    });
});

// Route: Handle table actions (view, add, delete, update)
app.get("/:action/:table", (req, res) => {
    const { action, table } = req.params;

    if (action === "view") {
        const table = req.params.table;
        const query = `SELECT * FROM "${table}"`;  // Select all rows from the table
    
        db.all(query, [], (err, rows) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send("Error fetching data.");
            }
            res.render("view_table", { rows, table });  // Render the view with updated rows
        });

    } else if (action === "add") {
        // Fetch table schema for dynamic form creation
        const query = `PRAGMA table_info(${table})`;  // Fetch table schema info
        db.all(query, [], (err, columns) => {
            if (err) {
                console.error(err.message);
                res.status(500).send(`Error retrieving schema for table ${table}.`);
            } else {
                res.render("add_row", { table, columns });  // Pass columns to the view
            }
        });

    } else if (action === "delete") {
        const query = `SELECT rowid, * FROM "${table}"`;  // Using rowid for deletion
        db.all(query, [], (err, rows) => {
            if (err) {
                console.error(err.message);
                res.status(500).send(`Error retrieving data for deletion in table ${table}.`);
            } else {
                res.render("delete_row", { table, rows });
            }
        });
        
    } else if (action === "update") {
        const query = `SELECT rowid, * FROM "${table}"`;  // Using rowid for the update
        db.all(query, [], (err, rows) => {
            if (err) {
                console.error(err.message);
                res.status(500).send(`Error retrieving data for update in table ${table}.`);
            } else {
                res.render("update_row", { table, rows });
            }
        });
    }
});

// Route: Display form to edit a row (GET)
app.get("/update/:table/:id", (req, res) => {
    const { table, id } = req.params;

    const query = `SELECT * FROM "${table}" WHERE rowid = ?`;
    db.get(query, [id], (err, row) => {
        if (err) {
            console.error(err.message);
            res.status(500).send(`Error retrieving data for update in table ${table}.`);
        } else {
            res.render("edit_row", { table, row });
        }
    });
});

// Route: Add row to a table (POST)
app.post("/add/:table", (req, res) => {
    const table = req.params.table;
    const columns = Object.keys(req.body);  // Get columns from the form data
    const values = Object.values(req.body); // Get values from the form data

    const query = `INSERT INTO "${table}" (${columns.join(",")}) VALUES (${values.map(() => "?").join(",")})`;

    db.run(query, values, (err) => {
        if (err) {
            console.error(err.message);
            res.status(500).send(`Error adding data to table ${table}.`);
        } else {
            res.redirect(`/view/${table}`);  // Redirect to the view route for that table
        }
    });
});

// Route: Handle deletion of a row (POST)
app.post("/delete/:table", (req, res) => {
    const table = req.params.table;
    const id = req.body.id;  // The id of the row to delete

    const query = `DELETE FROM "${table}" WHERE rowid = ?`;

    db.run(query, [id], (err) => {
        if (err) {
            console.error(err.message);
            res.status(500).send(`Error deleting row from table ${table}.`);
        } else {
            res.redirect(`/delete/${table}`);  // Redirect back to the delete page to refresh the view
        }
    });
});

app.post("/update/:table", (req, res) => {
    const table = req.params.table;
    const rowid = req.body.rowid;  // This should come from the hidden input field in the form
    const updates = Object.keys(req.body)
        .filter((key) => key !== "rowid")  // Exclude the rowid from the update fields
        .map((key) => `${key} = ?`);  // Dynamically build the set clauses for the update query
    const values = Object.values(req.body).filter((value, index) => index !== 0); // Filter out rowid value

    // If there are no updates, redirect back
    if (updates.length === 0) {
        return res.redirect(`/update/${table}`);
    }

    // Build the update SQL query
    const query = `UPDATE "${table}" SET ${updates.join(", ")} WHERE rowid = ?`;

    // Run the query with the values (including the rowid)
    db.run(query, [...values, rowid], (err) => {
        if (err) {
            console.error(err.message);
            res.status(500).send(`Error updating row in table ${table}.`);
        } else {
            // After a successful update, redirect to the view route to see the changes
            res.redirect(`/view/${table}`);
        }
    });
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
