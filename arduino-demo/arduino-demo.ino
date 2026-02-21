String storedData = "Initial Data";
bool awaitingDeleteConfirm = false;

void setup() {
  Serial.begin(9600);
  Serial.println("DEVICE READY");
}

void loop() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim(); // Remove whitespace/line endings

    // Handle Delete Confirmation State
    if (awaitingDeleteConfirm) {
      handleDeleteConfirmation(input);
    } else {
      processCommand(input);
    }
  }
}

void processCommand(String cmd) {
  if (cmd == "INFO") {
    Serial.println("MOCK DEVICE V1.0");
    Serial.println("STATUS: OK");
    finish();
  } 
  else if (cmd == "GET DATA") {
    Serial.print("DATA: ");
    Serial.println(storedData);
    finish();
  } 
  else if (cmd.startsWith("SET DATA ")) {
    // Extract everything after "SET DATA "
    storedData = cmd.substring(9);
    Serial.println("DATA UPDATED");
    finish();
  } 
  else if (cmd == "DEL DATA") {
    Serial.println("Are you sure? (Y/N)");
    awaitingDeleteConfirm = true;
    // Note: No 'finish()' here because we are waiting for user input
  } 
  else {
    Serial.println("ERROR: UNKNOWN COMMAND");
  }
}

void handleDeleteConfirmation(String response) {
  response.toUpperCase();
  if (response == "Y") {
    storedData = "";
    Serial.println("DATA DELETED");
    awaitingDeleteConfirm = false;
    finish();
  } else if (response == "N") {
    Serial.println("DELETE ABORTED");
    awaitingDeleteConfirm = false;
    finish();
  } else {
    Serial.println("INVALID RESPONSE. PLEASE ENTER Y OR N:");
  }
}

void finish() {
  Serial.println("CMD DONE");
}
