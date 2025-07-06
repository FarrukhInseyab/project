import { supabase } from '../lib/supabase';

export class PoDAPIService {
  // Update multiple records' status using customerno as reference
  static async updateRecordsStatus(customerNumbers: (string | number)[], newStatus: string) {
    try {
      console.log(`📝 Updating ${customerNumbers.length} PoDAPI records to status: ${newStatus}`);
      console.log('📋 Customer numbers:', customerNumbers);
      console.log('📋 Customer number types:', customerNumbers.map(num => typeof num));
      
      // Convert all customer numbers to integers since the DB column is bigint
      const validCustomerNumbers = customerNumbers
        .map(num => {
          // Convert to number, handling both string and number inputs
          const parsed = typeof num === 'string' ? parseInt(num, 10) : Number(num);
          return isNaN(parsed) ? null : parsed;
        })
        .filter(num => num !== null && num !== undefined) as number[];
      
      if (validCustomerNumbers.length === 0) {
        console.warn('⚠️ No valid customer numbers provided');
        return [];
      }
      
      console.log('📋 Valid customer numbers for update (as integers):', validCustomerNumbers);
      console.log('📋 Valid customer number types:', validCustomerNumbers.map(num => typeof num));
      
      // Use the customerno field as the identifier since that's the primary key
      // Make sure we're using integers to match the bigint column type
      const { data, error } = await supabase
        .from('ProofofDebitAPI')
        .update({ Status: newStatus })
        .in('customerno', validCustomerNumbers)
        .select('customerno, Status');

      if (error) {
        console.error('❌ Error updating PoDAPI records:', error);
        console.error('❌ Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log(`✅ Successfully updated ${data?.length || 0} PoDAPI records to status: ${newStatus}`);
      console.log('📋 Updated records:', data);
      
      // Check if all records were updated
      if (data && data.length !== validCustomerNumbers.length) {
        console.warn(`⚠️ Expected to update ${validCustomerNumbers.length} records, but only updated ${data.length}`);
        
        // Find which customer numbers weren't found
        const updatedCustomerNos = data.map(record => Number(record.customerno));
        const missingCustomerNos = validCustomerNumbers.filter(num => 
          !updatedCustomerNos.includes(num)
        );
        console.warn('📋 Missing customer numbers:', missingCustomerNos);
        
        // Debug: Check if these records exist in the database
        if (missingCustomerNos.length > 0) {
          console.log('🔍 Checking if missing records exist in database...');
          const { data: existingRecords, error: checkError } = await supabase
            .from('ProofofDebitAPI')
            .select('customerno, Status')
            .in('customerno', missingCustomerNos);
          
          if (!checkError && existingRecords) {
            console.log('📋 Found existing records for missing customer numbers:', existingRecords);
            existingRecords.forEach(record => {
              console.log(`  - Customer ${record.customerno}: Status = "${record.Status}"`);
            });
          } else {
            console.log('❌ Error checking existing records or no records found');
          }
        }
      }
      
      return data;
    } catch (error) {
      console.error('❌ Failed to update PoDAPI records status:', error);
      throw new Error(`Failed to update PoDAPI records: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get records by status
  static async getRecordsByStatus(status: string) {
    try {
      const { data, error } = await supabase
        .from('ProofofDebitAPI')
        .select('*')
        .eq('Status', status);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get PoDAPI records by status:', error);
      throw error;
    }
  }

  // Update single record status using customerno
  static async updateRecordStatus(customerNumber: string | number, newStatus: string) {
    try {
      // Convert to integer to match the bigint column type
      const customerNoInt = typeof customerNumber === 'string' ? parseInt(customerNumber, 10) : Number(customerNumber);
      
      if (isNaN(customerNoInt)) {
        throw new Error(`Invalid customer number: ${customerNumber}`);
      }
      
      console.log(`📝 Updating PoDAPI record ${customerNoInt} to status: ${newStatus}`);
      
      const { data, error } = await supabase
        .from('ProofofDebitAPI')
        .update({ Status: newStatus })
        .eq('customerno', customerNoInt)
        .select('customerno, Status')
        .single();

      if (error) throw error;
      
      console.log(`✅ Successfully updated PoDAPI record ${customerNoInt} to status: ${newStatus}`);
      return data;
    } catch (error) {
      console.error('Failed to update PoDAPI record status:', error);
      throw error;
    }
  }

  // Get all records with their customer numbers
  static async getAllRecords() {
    try {
      const { data, error } = await supabase
        .from('ProofofDebitAPI')
        .select('*')
        .order('customerno');

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get all PoDAPI records:', error);
      throw error;
    }
  }

  // Debug function to check what customer numbers exist in the database
  static async debugCustomerNumbers() {
    try {
      console.log('🔍 Debugging: Checking all customer numbers in ProofofDebitAPI...');
      
      const { data, error } = await supabase
        .from('ProofofDebitAPI')
        .select('customerno, Status')
        .order('customerno');

      if (error) throw error;
      
      console.log('📋 All customer numbers in database:', data?.map(r => ({
        customerno: r.customerno,
        type: typeof r.customerno,
        Status: r.Status
      })));
      
      return data;
    } catch (error) {
      console.error('Failed to debug customer numbers:', error);
      throw error;
    }
  }

  // Test RLS policies
  static async testRLSPolicies() {
    try {
      console.log('🔍 Testing RLS policies for ProofofDebitAPI...');
      
      // Test SELECT policy
      console.log('📋 Testing SELECT policy...');
      const { data: selectData, error: selectError } = await supabase
        .from('ProofofDebitAPI')
        .select('customerno, Status')
        .limit(5);
      
      if (selectError) {
        console.error('❌ SELECT policy failed:', selectError);
      } else {
        console.log('✅ SELECT policy working, sample records:', selectData);
      }
      
      // Test UPDATE policy (try to update a non-existent record to avoid affecting real data)
      console.log('📋 Testing UPDATE policy...');
      const { data: updateData, error: updateError } = await supabase
        .from('ProofofDebitAPI')
        .update({ Status: 'Current' })
        .eq('customerno', -999999) // Non-existent customer number
        .select('customerno, Status');
      
      if (updateError) {
        console.error('❌ UPDATE policy failed:', updateError);
        console.error('❌ This might indicate RLS policy issues');
      } else {
        console.log('✅ UPDATE policy working (no records updated as expected):', updateData);
      }
      
      return {
        selectWorking: !selectError,
        updateWorking: !updateError,
        selectError,
        updateError
      };
    } catch (error) {
      console.error('Failed to test RLS policies:', error);
      throw error;
    }
  }
}