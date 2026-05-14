{showAddForm && (
        <motion.div
          className="bg-white rounded-lg p-6 shadow border border-gray-200"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h4 className="font-bold text-md mb-4">Add New Staff Member</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="newName" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </Label>
            </div>