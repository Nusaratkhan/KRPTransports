const express = require("express");

const cors = require("cors");

const mongoose = require("mongoose");

const bcrypt = require("bcryptjs");

const multer = require("multer");

const Admin = require("./Admin");



// Attendance Schema

const attendanceSchema = new mongoose.Schema({

  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },

  name: String,

  status: String,

  date: String,

  createdAt: { type: Date, default: Date.now },

  updatedAt: { type: Date, default: Date.now },

  // Store driver snapshot at time of attendance for historical data

  driverSnapshot: {

    name: String,

    phoneNumber: String,

    licenseNumber: String,

    vehicleNumber: String

  }

});



const Attendance = mongoose.model("Attendance", attendanceSchema);



// Driver Schema

const driverSchema = new mongoose.Schema({

  name: { type: String, required: true },

  phoneNumber: { type: String, required: true },

  licenseNumber: { type: String, required: true },

  vehicleNumber: { type: String, required: true },

  createdAt: { type: Date, default: Date.now },

  updatedAt: { type: Date, default: Date.now }

});



const Driver = mongoose.model("Driver", driverSchema);



// Driver License Renewals Schema
const licenseRenewalSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
  driverName: { type: String, required: true },
  licenseNumber: { type: String, required: true },
  expiryDate: { type: Date, required: true },
  licenseFile: { type: String }, // File path or URL
  status: { 
    type: String, 
    enum: ['Valid', 'Expiring Soon', 'Expired'], 
    default: 'Valid' 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Vehicle RC Renewals Schema
const rcRenewalSchema = new mongoose.Schema({
  vehicleNumber: { type: String, required: true },
  rcNumber: { type: String, required: true },
  expiryDate: { type: Date, required: true },
  rcFile: { type: String }, // File path or URL
  status: { 
    type: String, 
    enum: ['Valid', 'Expiring Soon', 'Expired'], 
    default: 'Valid' 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const LicenseRenewal = mongoose.model("LicenseRenewal", licenseRenewalSchema);
const RCRenewal = mongoose.model("RCRenewal", rcRenewalSchema);

// Contact Message Schema
const contactMessageSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String },
  companyName: { type: String, required: true },
  jobTitle: { type: String },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  state: { type: String, required: true },
  city: { type: String },
  inquiries: { type: String, required: true },
  source: { type: String, required: true }, // How did you hear about us
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const ContactMessage = mongoose.model("ContactMessage", contactMessageSchema);

require("dotenv").config({ path: "./server.env" });



const app = express();



app.use(cors());

app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// MongoDB Connection

mongoose.connect(process.env.MONGO_URI)

.then(() => console.log("MongoDB Connected ✅"))

.catch((err) => console.log("DB Error:", err));



// Home Route

app.get("/", (req, res) => {

  res.send("KRP Backend Running Successfully ");

});



// Create First Admin

app.get("/create-admin", async (req, res) => {

  try {

    const existingAdmin = await Admin.findOne({ username: "admin" });



    if (existingAdmin) {

      return res.send("Admin already exists ");

    }



    const hashedPassword = await bcrypt.hash("200624", 10);



    const admin = new Admin({

      username: "admin",

      password: hashedPassword

    });



    await admin.save();



    res.send("Admin Created Successfully ");

  } catch (error) {

    res.status(500).send("Error creating admin");

  }});

// Login Endpoint

app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const admin = await Admin.findOne({ username, password });

        if (admin) {
            res.json({ success: true });
        } else {
            res.json({
                success: false,
                message: "Invalid username or password"
            });
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// Get active drivers for attendance dropdown

app.get("/active-drivers", async (req, res) => {

  try {

    const drivers = await Driver.find().sort({ name: 1 });

    res.json({

      success: true,

      data: drivers

    });

  } catch (error) {

    console.error("Get active drivers error:", error);

    res.status(500).json({

      success: false,

      message: "Server error fetching active drivers"

    });

  }

});



// Attendance Endpoints

app.post("/attendance", async (req, res) => {

  try {

    const { driverId, name, status, date } = req.body;



    if (!driverId || !name || !status || !date) {

      return res.status(400).json({ 

        success: false, 

        message: "Driver ID, name, status, and date are required" 

      });

    }



    // Check if driver exists (for validation)

    const driver = await Driver.findById(driverId);

    if (!driver) {

      return res.status(400).json({

        success: false,

        message: "Driver not found in system"

      });

    }



    // Check if attendance already exists for this driver and date

    const existingAttendance = await Attendance.findOne({ driverId, date });

    if (existingAttendance) {

      // Update existing attendance

      existingAttendance.status = status;

      existingAttendance.name = name; // Update name in case driver name changed

      existingAttendance.updatedAt = Date.now();

      await existingAttendance.save();

      return res.json({ 

        success: true, 

        message: "Attendance updated successfully",

        data: existingAttendance

      });

    }



    // Create new attendance record with driverId and snapshot data

    const attendance = new Attendance({

      driverId,

      name,

      status,

      date,

      // Store driver snapshot at time of attendance for historical data

      driverSnapshot: {

        name: driver.name,

        phoneNumber: driver.phoneNumber,

        licenseNumber: driver.licenseNumber,

        vehicleNumber: driver.vehicleNumber

      }

    });



    await attendance.save();



    res.json({ 

      success: true, 

      message: "Attendance marked successfully",

      data: attendance

    });



  } catch (error) {

    console.error("Attendance error:", error);

    res.status(500).json({ 

      success: false, 

      message: "Server error during attendance marking" 

    });

  }

});



app.get("/attendance", async (req, res) => {

  try {

    const attendance = await Attendance.find().sort({ createdAt: -1 });

    res.json({ 

      success: true, 

      data: attendance 

    });

  } catch (error) {

    console.error("Get attendance error:", error);

    res.status(500).json({ 

      success: false, 

      message: "Server error fetching attendance records" 

    });

  }

});



// POST /contact - Handle contact form submissions
app.post("/contact", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      companyName,
      jobTitle,
      email,
      phone,
      state,
      city,
      inquiries,
      source
    } = req.body;

    // Validate required fields
    if (!firstName || !companyName || !email || !phone || !state || !inquiries || !source) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled"
      });
    }

    // Create new contact message
    const contactMessage = new ContactMessage({
      firstName,
      lastName,
      companyName,
      jobTitle,
      email,
      phone,
      state,
      city,
      inquiries,
      source,
      isRead: false
    });

    await contactMessage.save();

    res.json({
      success: true,
      message: "Contact form submitted successfully",
      data: contactMessage
    });

  } catch (error) {
    console.error("Contact form submission error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during contact form submission"
    });
  }
});

// GET /messages - Return all messages newest first
app.get("/messages", async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: messages
    });

  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching messages"
    });
  }
});

// PUT /messages/:id/read - Mark selected message as opened/read
app.put("/messages/:id/read", async (req, res) => {
  try {
    const { id } = req.params;

    const message = await ContactMessage.findByIdAndUpdate(
      id,
      { isRead: true, updatedAt: Date.now() },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    res.json({
      success: true,
      message: "Message marked as read",
      data: message
    });

  } catch (error) {
    console.error("Mark message as read error:", error);
    res.status(500).json({
      success: false,
      message: "Server error marking message as read"
    });
  }
});

// Dashboard Statistics Endpoint

app.get("/dashboard-stats", async (req, res) => {

  try {

    const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

    console.log(" Fetching dashboard stats for:", today);

    

    // Get all active drivers from Driver Management

    const allDrivers = await Driver.find();

    const activeDrivers = allDrivers.length;

    console.log(" Active drivers found:", activeDrivers);

    

    // Get today's attendance records

    const todayAttendance = await Attendance.find({ date: today });

    console.log(" Today's attendance records:", todayAttendance.length);

    

    // Count present today

    const presentToday = todayAttendance.filter(record => record.status === 'present').length;

    console.log(" Present today:", presentToday);

    

    // Count absent/on leave today

    const onLeave = todayAttendance.filter(record => record.status === 'absent').length;

    console.log(" On leave today:", onLeave);

    

    // Count unread contact messages
    const unreadMessages = await ContactMessage.countDocuments({ isRead: false });

    console.log(" Unread messages:", unreadMessages);

    

    const statsData = {

      activeDrivers,

      presentToday,

      onLeave,

      newMessages: unreadMessages

    };

    console.log(" Dashboard stats:", statsData);

    res.json({

      success: true,

      data: statsData

    });

  } catch (error) {

    console.error(" Dashboard stats error:", error);

    res.status(500).json({ 

      success: false, 

      message: "Server error fetching dashboard statistics" 

    });

  }

});

// Driver CRUD Endpoints



// Get all drivers

app.get("/drivers", async (req, res) => {

  try {

    const drivers = await Driver.find().sort({ createdAt: -1 });

    res.json({

      success: true,

      data: drivers

    });

  } catch (error) {

    console.error("Get drivers error:", error);

    res.status(500).json({

      success: false,

      message: "Server error fetching drivers"

    });

  }

});



// Create new driver

app.post("/drivers", async (req, res) => {

  try {

    const { name, phoneNumber, licenseNumber, vehicleNumber } = req.body;



    if (!name || !phoneNumber || !licenseNumber || !vehicleNumber) {

      return res.status(400).json({

        success: false,

        message: "All fields are required"

      });

    }



    // Check if driver with same license number already exists

    const existingDriver = await Driver.findOne({ licenseNumber });

    if (existingDriver) {

      return res.status(400).json({

        success: false,

        message: "Driver with this license number already exists"

      });

    }



    const driver = new Driver({

      name,

      phoneNumber,

      licenseNumber,

      vehicleNumber

    });



    await driver.save();



    res.json({

      success: true,

      message: "Driver created successfully",

      data: driver

    });

  } catch (error) {

    console.error("Create driver error:", error);

    res.status(500).json({

      success: false,

      message: "Server error creating driver"

    });

  }

});



// Update driver

app.put("/drivers/:id", async (req, res) => {

  try {

    const { id } = req.params;

    const { name, phoneNumber, licenseNumber, vehicleNumber } = req.body;



    if (!name || !phoneNumber || !licenseNumber || !vehicleNumber) {

      return res.status(400).json({

        success: false,

        message: "All fields are required"

      });

    }



    const driver = await Driver.findByIdAndUpdate(

      id,

      { name, phoneNumber, licenseNumber, vehicleNumber, updatedAt: Date.now() },

      { new: true }

    );



    if (!driver) {

      return res.status(404).json({

        success: false,

        message: "Driver not found"

      });

    }



    res.json({

      success: true,

      message: "Driver updated successfully",

      data: driver

    });

  } catch (error) {

    console.error("Update driver error:", error);

    res.status(500).json({

      success: false,

      message: "Server error updating driver"

    });

  }

});



// Delete driver

app.delete("/drivers/:id", async (req, res) => {

  try {

    const { id } = req.params;



    const driver = await Driver.findByIdAndDelete(id);



    if (!driver) {

      return res.status(404).json({

        success: false,

        message: "Driver not found"

      });

    }



    res.json({

      success: true,

      message: "Driver deleted successfully",

      data: driver

    });

  } catch (error) {

    console.error("Delete driver error:", error);

    res.status(500).json({

      success: false,

      message: "Server error deleting driver"

    });

  }

});



// Documents & Renewals Endpoints

// Driver License Renewals CRUD
app.get("/license-renewals", async (req, res) => {
  try {
    const licenseRenewals = await LicenseRenewal.find()
      .populate('driverId', 'name')
      .sort({ expiryDate: 1 });
    
    // Calculate days left and update status
    const today = new Date();
    const updatedRenewals = licenseRenewals.map(renewal => {
      const daysLeft = Math.ceil((renewal.expiryDate - today) / (1000 * 60 * 60 * 24));
      let status = 'Valid';
      
      if (daysLeft < 0) {
        status = 'Expired';
      } else if (daysLeft <= 30) {
        status = 'Expiring Soon';
      }
      
      return {
        ...renewal.toObject(),
        daysLeft,
        status
      };
    });
    
    res.json({
      success: true,
      data: updatedRenewals
    });
  } catch (error) {
    console.error("Get license renewals error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching license renewals"
    });
  }
});

app.post("/license-renewals", upload.single('licenseFile'), async (req, res) => {
  try {
    const { driverId, driverName, licenseNumber, expiryDate } = req.body;

    if (!driverId || !driverName || !licenseNumber || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Check if driver exists
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(400).json({
        success: false,
        message: "Driver not found"
      });
    }

    // Calculate status based on expiry date
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    let status = 'Valid';
    
    if (daysLeft < 0) {
      status = 'Expired';
    } else if (daysLeft <= 30) {
      status = 'Expiring Soon';
    }

    // Prepare renewal data
    const renewalData = {
      driverId,
      driverName,
      licenseNumber,
      expiryDate,
      status
    };

    // Add file path if a file was uploaded
    if (req.file) {
      renewalData.licenseFile = `/uploads/${req.file.filename}`;
    }

    const licenseRenewal = new LicenseRenewal(renewalData);

    await licenseRenewal.save();

    res.json({
      success: true,
      message: "License renewal created successfully",
      data: {
        ...licenseRenewal.toObject(),
        daysLeft
      }
    });
  } catch (error) {
    console.error("Create license renewal error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating license renewal"
    });
  }
});

app.put("/license-renewals/:id", upload.single('licenseFile'), async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId, driverName, licenseNumber, expiryDate } = req.body;

    if (!driverId || !driverName || !licenseNumber || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Calculate status based on expiry date
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    let status = 'Valid';
    
    if (daysLeft < 0) {
      status = 'Expired';
    } else if (daysLeft <= 30) {
      status = 'Expiring Soon';
    }

    // Prepare update data
    const updateData = {
      driverId,
      driverName,
      licenseNumber,
      expiryDate,
      status,
      updatedAt: Date.now()
    };

    // Add file path if a new file was uploaded
    if (req.file) {
      updateData.licenseFile = `/uploads/${req.file.filename}`;
    }

    const licenseRenewal = await LicenseRenewal.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!licenseRenewal) {
      return res.status(404).json({
        success: false,
        message: "License renewal not found"
      });
    }

    res.json({
      success: true,
      message: "License renewal updated successfully",
      data: {
        ...licenseRenewal.toObject(),
        daysLeft
      }
    });
  } catch (error) {
    console.error("Update license renewal error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating license renewal"
    });
  }
});

app.delete("/license-renewals/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const licenseRenewal = await LicenseRenewal.findByIdAndDelete(id);

    if (!licenseRenewal) {
      return res.status(404).json({
        success: false,
        message: "License renewal not found"
      });
    }

    res.json({
      success: true,
      message: "License renewal deleted successfully",
      data: licenseRenewal
    });
  } catch (error) {
    console.error("Delete license renewal error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting license renewal"
    });
  }
});

// Vehicle RC Renewals CRUD
app.get("/rc-renewals", async (req, res) => {
  try {
    const rcRenewals = await RCRenewal.find().sort({ expiryDate: 1 });
    
    // Calculate days left and update status
    const today = new Date();
    const updatedRenewals = rcRenewals.map(renewal => {
      const daysLeft = Math.ceil((renewal.expiryDate - today) / (1000 * 60 * 60 * 24));
      let status = 'Valid';
      
      if (daysLeft < 0) {
        status = 'Expired';
      } else if (daysLeft <= 30) {
        status = 'Expiring Soon';
      }
      
      return {
        ...renewal.toObject(),
        daysLeft,
        status
      };
    });
    
    res.json({
      success: true,
      data: updatedRenewals
    });
  } catch (error) {
    console.error("Get RC renewals error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching RC renewals"
    });
  }
});

app.post("/rc-renewals", upload.single('rcFile'), async (req, res) => {
  try {
    const { vehicleNumber, rcNumber, expiryDate } = req.body;

    if (!vehicleNumber || !rcNumber || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Calculate status based on expiry date
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    let status = 'Valid';
    
    if (daysLeft < 0) {
      status = 'Expired';
    } else if (daysLeft <= 30) {
      status = 'Expiring Soon';
    }

    // Prepare renewal data
    const renewalData = {
      vehicleNumber,
      rcNumber,
      expiryDate,
      status
    };

    // Add file path if a file was uploaded
    if (req.file) {
      renewalData.rcFile = `/uploads/${req.file.filename}`;
    }

    const rcRenewal = new RCRenewal(renewalData);

    await rcRenewal.save();

    res.json({
      success: true,
      message: "RC renewal created successfully",
      data: {
        ...rcRenewal.toObject(),
        daysLeft
      }
    });
  } catch (error) {
    console.error("Create RC renewal error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating RC renewal"
    });
  }
});

app.put("/rc-renewals/:id", upload.single('rcFile'), async (req, res) => {
  try {
    const { id } = req.params;
    const { vehicleNumber, rcNumber, expiryDate } = req.body;

    if (!vehicleNumber || !rcNumber || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Calculate status based on expiry date
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    let status = 'Valid';
    
    if (daysLeft < 0) {
      status = 'Expired';
    } else if (daysLeft <= 30) {
      status = 'Expiring Soon';
    }

    // Prepare update data
    const updateData = {
      vehicleNumber,
      rcNumber,
      expiryDate,
      status,
      updatedAt: Date.now()
    };

    // Add file path if a new file was uploaded
    if (req.file) {
      updateData.rcFile = `/uploads/${req.file.filename}`;
    }

    const rcRenewal = await RCRenewal.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!rcRenewal) {
      return res.status(404).json({
        success: false,
        message: "RC renewal not found"
      });
    }

    res.json({
      success: true,
      message: "RC renewal updated successfully",
      data: {
        ...rcRenewal.toObject(),
        daysLeft
      }
    });
  } catch (error) {
    console.error("Update RC renewal error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating RC renewal"
    });
  }
});

app.delete("/rc-renewals/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const rcRenewal = await RCRenewal.findByIdAndDelete(id);

    if (!rcRenewal) {
      return res.status(404).json({
        success: false,
        message: "RC renewal not found"
      });
    }

    res.json({
      success: true,
      message: "RC renewal deleted successfully",
      data: rcRenewal
    });
  } catch (error) {
    console.error("Delete RC renewal error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting RC renewal"
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});